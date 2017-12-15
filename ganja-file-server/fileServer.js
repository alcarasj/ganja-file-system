const express = require('express');
const path = require("path");
const bodyParser = require("body-parser");
const fs = require('fs-extra');
const dns = require('dns');
const request = require('request');
const FormData = require('form-data');
const formidable = require('formidable');
const jwt = require('jsonwebtoken');
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss' });

if (process.argv.length <= 2) {
  console.log("Usage: " + __filename + " PORT_NUMBER");
  process.exit(-1);
}

const PORT = process.argv[2];
//For testing on localhost with multiple file servers on each cluster
switch (PORT) {
  case '8090':
    SERVER_ID = 0;
    break;
  case '8091':
    SERVER_ID = 1;
    break;
  case '8092':
    SERVER_ID = 2;
    break;
  case '8093':
    SERVER_ID = 3;
    break;
  case '8094':
    SERVER_ID = 4;
    break;
  case '8095':
    SERVER_ID = 5;
    break;
  case '8096':
    SERVER_ID = 6;
    break;
  case '8097':
    SERVER_ID = 7;
    break;
  case '8098':
    SERVER_ID = 8;
    break;
}
const DATADIR = './data-' + SERVER_ID;
//This secret is just used for testing purposes. In production, use environment variable.
const SECRET = 'yallmothafuckasneedjesus';
const READLOG = '[READ] ';
const WRITELOG = '[WRITE] ';
const DELETELOG = '[DELETE] ';
var SERVER_ID;

if (!fs.existsSync(DATADIR)) {
  fs.mkdirSync(DATADIR);
}

var fileServer = express();
fileServer.use(bodyParser.urlencoded({ extended: false }));
fileServer.use(bodyParser.json());

fileServer.post('/upload', (req, res) => {
  var form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    const file = files.file;
    const fileName = fields.fileName;
    const overwrite = fields.overwrite;
    fs.copySync(file.path, path.join(__dirname, DATADIR, fileName), { overwrite: overwrite, errorOnExist: false });
    console.log(WRITELOG + fileName);
    return res.status(200).send({ success: true, message: fileName + " successfully uploaded."});
  });
});

fileServer.get('/delete', (req, res) => {
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(401).send({ success: false, message: 'No token provided.' });
  }
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).send({ success: false, message: 'Failed to authenticate token.' });
    }
    if (req.query.fileName) {
      const fileName = req.query.fileName;
      fs.unlink(path.join(__dirname, DATADIR, fileName), (err) => {
        if (err) {
          console.error(err)
          return res.status(500).send({ success: false, message: "Unable to delete " + fileName });
        }
        console.log(DELETELOG + fileName);
        return res.status(200).send({ success: true, message: fileName + " successfully deleted." });
      })
    } else {
      return res.status(400).send({ success: false, message: "No file name provided." });
    }
  });
});

fileServer.get('/download', (req, res) => {
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(401).send({ success: false, message: 'No token provided.' });
  }
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).send({ success: false, message: 'Failed to authenticate token.' });
    }
    if (req.query.fileName) {
      const fileName = req.query.fileName;
      const localPath = path.join(__dirname, DATADIR, fileName);
      console.log(READLOG + fileName);
      return res.sendFile(localPath);
    } else {
      return res.status(400).send({ success: false, message: "No file name provided." });
    }
  });
});

fileServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Web server failed to start.', err);
  }
  console.log(`File server listening on port ${PORT}.`);
});
