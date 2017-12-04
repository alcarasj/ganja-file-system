const express = require('express');
const path = require("path");
const bodyParser = require("body-parser");
const fs = require('fs-extra');
const dns = require('dns');
const request = require('request');
const FormData = require('form-data');
const formidable = require('formidable');
const mime = require('mime-types');
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss' });

if (process.argv.length <= 2) {
  console.log("Usage: " + __filename + " PORT_NUMBER");
  process.exit(-1);
}

const PORT = process.argv[2];
const DATADIR = './data';

if (!fs.existsSync(DATADIR)) {
  fs.mkdirSync(DATADIR);
}

var fileServer = express();
fileServer.use(bodyParser.urlencoded({ extended: false }));
fileServer.use(bodyParser.json());

fileServer.get('/', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  console.log(clientLog + "Connected.");
  res.send("Welcome to Ganja File Server.")
});

fileServer.post('/write', (req, res) => {
  var form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    const file = files.file;
    const fileName = fields.fileName;
    const fileServerID = fields.fileServerID;
    const writeLog = '[FILES-' + fileServerID + ' WRITE] ';
    fs.copySync(file.path, path.join(__dirname, DATADIR, fileName), { overwrite: true, errorOnExist: false });
    console.log(writeLog + name);
    res.sendStatus(200);
  });
});

fileServer.get('/read', (req, res) => {
  const fileName = req.query.fileName;
  const localPath = path.join(__dirname, DATADIR, fileName);
  const contentType = mime.lookup(localPath);
  const stat = fs.statSync(localPath);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);
  res.status(200);
  fs.createReadStream(localPath).pipe(res);
});

fileServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Web server failed to start.', err);
  }
  console.log(`File server listening on port ${PORT}.`);
});
