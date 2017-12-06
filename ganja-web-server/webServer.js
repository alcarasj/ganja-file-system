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
const formidable = require('formidable');
const querystring = require("querystring");
const mime = require('mime-types');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const PORT = 8080;
const HASH_ALGORITHM = 'sha-256';
const TMPDIR = './tmp';
const FILE_SERVERS = ['127.0.0.1:8081', '127.0.0.1:8082', '127.0.0.1:8083'];
const AUTH_SERVER = '127.0.0.1:8070'
var roundRobin = 0;
var db = new sqlite3.Database('database.db', (err) => {
  if (err) {
    console.error(err.message)
  }
  console.log("Connected to SQLite database.");
});
db.run("CREATE TABLE IF NOT EXISTS directory (file_name TEXT PRIMARY KEY, server_ip TEXT NOT NULL)");

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

webServer.post('/login', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  console.log(clientLog + "Login initiated for " + req.body.email);
  res.redirect(307, 'http://' + AUTH_SERVER + '/authenticate');
});

webServer.post('/upload', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  var reqForm = new formidable.IncomingForm();
  reqForm.parse(req, (err, fields, files) => {
    const localPath = files.file.path;
    const fileName = files.file.name;
    const form = {
      file: fs.createReadStream(localPath),
      fileName: fileName,
      fileServerID: roundRobin,
    };
    var stmt = db.prepare('INSERT INTO directory (file_name, server_ip) VALUES (?, ?)');
    stmt.run(fileName, FILE_SERVERS[roundRobin]);
    stmt.finalize();
    if (roundRobin >= FILE_SERVERS.length) {
      roundRobin = 0;
    }
    request.post({ url: 'http://' + FILE_SERVERS[roundRobin] + '/write', formData: form }, (err, slaveRes, body) => {
      if (err) {
        return console.error(err);
      }
      res.sendStatus(200);
    });
    roundRobin++;
  });
});

webServer.get('/delete', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  //TODO
});

webServer.get('/download', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  const fileName = req.query.fileName;
  db.each("SELECT * FROM directory", (err, row) => {
    if (err) {
      console.error(err);
    }
    if (row.file_name === fileName) {
      const fileServerIP = row.server_ip;
      const encodedFileName = querystring.stringify({ fileName });
      res.redirect('http://' + fileServerIP + '/download?' + encodedFileName);
    }
  });
});

webServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Web server failed to start.', err);
  }
  console.log(`Web server listening on port ${PORT}.`);
});
