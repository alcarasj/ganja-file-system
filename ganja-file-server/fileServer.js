const express = require('express');
const path = require("path");
const bodyParser = require("body-parser");
const fs = require('fs-extra');
const dns = require('dns');
const request = require('request');
const FormData = require('form-data');
const formidable = require('formidable');
const mime = require('mime-types');
const jwt = require('jsonwebtoken');
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss' });

if (process.argv.length <= 2) {
  console.log("Usage: " + __filename + " PORT_NUMBER");
  process.exit(-1);
}

const PORT = process.argv[2];
const DATADIR = './data';
//This secret is just used for testing purposes. In production, use environment variable.
const SECRET = 'yallmothafuckasneedjesus';
const READLOG = '[READ] ';
const UPLOADLOG = '[WRITE] ';
const DELETELOG = '[DELETE] ';

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
    fs.copySync(file.path, path.join(__dirname, DATADIR, fileName), { overwrite: true, errorOnExist: false });
    console.log(UPLOADLOG + fileName);
    return res.sendStatus(200);
  });
});

fileServer.get('/delete', (req, res) => {
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(401).send({ auth: false, message: 'No token provided.' });
  }
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
    }
    if (req.query.fileName) {
      const fileName = req.query.fileName;
      fs.unlink(path.join(__dirname, DATADIR, fileName), (err) => {
        if (err) {
          console.error(err)
          return res.sendStatus(500);
        }
        console.log(DELETELOG + fileName);
        return res.sendStatus(200);
      })
    } else {
      return res.sendStatus(400);
    }
  });
});

fileServer.get('/download', (req, res) => {
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(401).send({ auth: false, message: 'No token provided.' });
  }
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
    }
    if (req.query.fileName) {
      const fileName = req.query.fileName;
      const localPath = path.join(__dirname, DATADIR, fileName);
      console.log(READLOG + fileName);
      return res.sendFile(localPath);
    } else {
      return res.sendStatus(400);
    }
  });
});

fileServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Web server failed to start.', err);
  }
  console.log(`File server listening on port ${PORT}.`);
});
