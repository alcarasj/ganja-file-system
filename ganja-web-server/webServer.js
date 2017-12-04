const express = require('express');
const path = require("path");
const bodyParser = require("body-parser");
const fs = require('fs');
const dns = require('dns');
const request = require('request');
const FormData = require('form-data');
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss' });

const PORT = 8080;
const TMPDIR = './tmp';

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
  //TODO
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
