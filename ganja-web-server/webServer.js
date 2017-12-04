const express = require('express');
const path = require("path");
const bodyParser = require("body-parser");
const fs = require('fs');
const dns = require('dns');
const request = require('request');
const FormData = require('form-data');
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss' });
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const PORT = 8080;
const HASH_ALGORITHM = 'sha-256';
const TMPDIR = './tmp';
const FILE_SERVERS = ['127.0.0.1:8081', '127.0.0.1:8082', '127.0.0.1:8083'];
var fileServerIndex = 0;
var db = new sqlite3.Database(':memory:');

if (!fs.existsSync(TMPDIR)) {
  fs.mkdirSync(TMPDIR);
}

var webServer = express();
webServer.use(bodyParser.urlencoded({ extended: false }));
webServer.use(bodyParser.json());

webServer.get('/', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  console.log(clientLog + "Connected.");
  res.sendFile(path.join(__dirname + '/index.html'));
});

webServer.get('/files', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
});

webServer.post('/upload', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  const localPath = path.join(__dirname, "testFile.txt");
  const form = {
    file: fs.createReadStream(localPath),
  };
  if (fileServerIndex >= FILE_SERVERS.length) {
    fileServerIndex = 0;
  }
  request.post({ url: 'http://' + FILE_SERVERS[fileServerIndex] + '/write', formData: form }, (err, slaveRes, body) => {
    if (err) {
      return console.error(err);
    } else {
      res.sendStatus(200);
    }
  });
  fileServerIndex++;
});

webServer.get('/download', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  //TODO
});

webServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Web server failed to start.', err);
  }
  console.log(`Web server listening on port ${PORT}.`);
});
