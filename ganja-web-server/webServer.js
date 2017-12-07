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
const CLUSTER_SERVERS = ['127.0.0.1:8081', '127.0.0.1:8082', '127.0.0.1:8083'];
const AUTH_SERVER = '127.0.0.1:8070';
//This secret is just used for testing purposes. In production, use environment variable.
const SECRET = 'yallmothafuckasneedjesus';
var roundRobin = 0;
var db = new sqlite3.Database('WEB.db', (err) => {
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
  db.all("SELECT * FROM directory", (err, rows) => {
    if (err) {
      console.error(err);
      return res.sendStatus(500);
    }
    res.write("<h1>Ganja File System</h1>");
    res.write("<h2>Files currently in server</h2>");
    rows.forEach((row) => {
      const encodedFileName = querystring.stringify({ fileName: row.file_name });
      res.write("<br>" + row.file_name + "</br>");
    });
    return res.end();
  });
});

webServer.post('/login', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  console.log(clientLog + "Login initiated for " + req.body.email);
  return res.redirect(307, 'http://' + AUTH_SERVER + '/authenticate');
});

webServer.post('/upload', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  var reqForm = new formidable.IncomingForm();
  reqForm.parse(req, (err, fields, files) => {
    const localPath = files.file.path;
    const lockable = fields.lockable;
    const fileName = files.file.name;
    const form = {
      file: fs.createReadStream(localPath),
      fileName: fileName,
      clusterServerID: roundRobin,
    };
    db.all("SELECT * FROM directory", (err, rows) => {
      if (err) {
        console.error(err);
        return res.sendStatus(500);
      }
      if (rows) {
        const dirRow = rows.filter((row) => {
          return row.file_name === fileName;
        });
        if (dirRow.length === 0) {
          var stmt = db.prepare('INSERT INTO directory (file_name, server_ip) VALUES (?, ?)');
          stmt.run(fileName, CLUSTER_SERVERS[roundRobin]);
          stmt.finalize();
          if (roundRobin >= CLUSTER_SERVERS.length) {
            roundRobin = 0;
          }
          console.log(clientLog + "Upload requested for " + fileName)
          request.post({ url: 'http://' + CLUSTER_SERVERS[roundRobin] + '/upload', formData: form }, (err, clusterRes, clusterBody) => {
            if (err) {
              console.error(err);
              return res.sendStatus(500);
            }
            roundRobin++;
            return res.sendStatus(200);
          });
        } else if (dirRow.length === 1) {
          //File exists, overwrite or make duplicate?
        } else {
          return res.sendStatus(500);
        }
      } else {
        return res.sendStatus(500);
      }
    });
  });
});

webServer.get('/overwrite', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  //TODO
});

webServer.delete('/delete', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(401).send({ auth: false, message: 'No token provided.' });
  }
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
    }
    if (req.body.fileName) {
      const fileName = req.body.fileName;
      db.each("SELECT * FROM directory", (err, row) => {
        if (err) {
          console.error(err);
        }
        if (row.file_name === fileName) {
          const clientLog = "[" + req.ip + "] ";
          const clusterServerIP = row.server_ip;
          const encodedFileName = querystring.stringify({ fileName });
          console.log(clientLog + "Delete requested for " + fileName);
          db.run("DELETE FROM directory WHERE file_name=?", fileName, (err) => {
            if (err) {
              console.error(err);
              return res.sendStatus(500);
            }
          });
          res.header('x-access-token', token);
          return res.redirect('http://' + clusterServerIP + '/delete?' + encodedFileName);
        }
      });
    } else {
      return res.status(400).send("No file name provided.")
    }
  });
});

webServer.get('/download', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
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
      db.each("SELECT * FROM directory", (err, row) => {
        if (err) {
          console.error(err);
        }
        if (row.file_name === fileName) {
          const clusterServerIP = row.server_ip;
          const encodedFileName = querystring.stringify({ fileName });
          console.log(clientLog + "Download requested for " + fileName);
          res.header('x-access-token', token);
          return res.redirect('http://' + clusterServerIP + '/download?' + encodedFileName);
        }
      });
    } else {
      return res.status(400).send("No file name provided.")
    }
  });
});

webServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Web server failed to start.', err);
  }
  console.log(`Web server listening on port ${PORT}.`);
});
