const express = require('express');
const path = require("path");
const bodyParser = require("body-parser");
const fs = require('fs');
const dns = require('dns');
const request = require('request');
const FormData = require('form-data');
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss' });
const sqlite3 = require('sqlite3').verbose();
const sha1 = require('sha1');
const formidable = require('formidable');
const querystring = require("querystring");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

if (process.argv.length <= 2) {
  console.log("Usage: " + __filename + " PORT_NUMBER");
  process.exit(-1);
}

const PORT = process.argv[2];
const TMPDIR = './tmp';
const AUTH_SERVER = '127.0.0.1:8070';
//This secret is just used for testing purposes. In production, use environment variable.
const SECRET = 'yallmothafuckasneedjesus';

var FILE_SERVERS = [];
var CLUSTER_ID;

//For testing on localhost with multiple cluster servers
if (PORT === '8081') {
  FILE_SERVERS = ['127.0.0.1:8090', '127.0.0.1:8091', '127.0.0.1:8092'];
  CLUSTER_ID = 0;
} else if (PORT === '8082') {
  FILE_SERVERS = ['127.0.0.1:8093', '127.0.0.1:8094', '127.0.0.1:8095'];
  CLUSTER_ID = 1;
} else if (PORT === '8083') {
  FILE_SERVERS = ['127.0.0.1:8096', '127.0.0.1:8097', '127.0.0.1:8098'];
  CLUSTER_ID = 2;
}

var roundRobin = 0;
var db = new sqlite3.Database('CLUSTER-' + CLUSTER_ID + '.db', (err) => {
  if (err) {
    console.error(err.message)
  }
  console.log("Connected to SQLite database.");
});
db.run("CREATE TABLE IF NOT EXISTS directory (file_name TEXT PRIMARY KEY, server_ip TEXT NOT NULL)");

if (!fs.existsSync(TMPDIR)) {
  fs.mkdirSync(TMPDIR);
}

var clusterServer = express();
clusterServer.use(bodyParser.urlencoded({ extended: false }));
clusterServer.use(bodyParser.json());

clusterServer.post('/upload', (req, res) => {
  var reqForm = new formidable.IncomingForm();
  reqForm.parse(req, (err, fields, files) => {
    const localPath = files.file.path;
    const overwrite = fields.overwrite;
    const fileName = fields.fileName;
    const form = {
      file: fs.createReadStream(localPath),
      fileName: fileName,
      fileServerID: roundRobin,
      overwrite: overwrite,
    };

    db.all("SELECT * FROM directory WHERE file_name=?", fileName, (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).send({ success: false, message: "Failed to delete " + fileName + err });
      }
      if (rows[0] && rows.length === 1 && rows[0].file_name === fileName) {
        if (overwrite) {
          request.post({ url: 'http://' + FILE_SERVERS[roundRobin] + '/upload', formData: form }, (err, fileRes, fileBody) => {
            if (err) {
              return console.error(err);
            }
            if (fileBody) {
              const parsedFileBody = JSON.parse(fileBody);
              if (parsedFileBody.success) {
                if (++roundRobin >= FILE_SERVERS.length) {
                  roundRobin = 0;
                }
                return res.status(200).send({ success: true, message: fileName + " successfully uploaded."});
              } else {
                return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName });
              }
            } else {
              return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName });
            }
          });
        }  else {
          return res.status(400).send({ success: false, message: fileName + " already exists. Pass overwrite: true in your POST request body (multipart/form-data) to overwrite the existing file." });
        }
      } else {
        var stmt = db.prepare('INSERT INTO directory (file_name, server_ip) VALUES (?, ?)');
        stmt.run(fileName, FILE_SERVERS[roundRobin]);
        stmt.finalize();
        request.post({ url: 'http://' + FILE_SERVERS[roundRobin] + '/upload', formData: form }, (err, fileRes, fileBody) => {
          if (err) {
            return console.error(err);
          }
          if (fileBody) {
            const parsedFileBody = JSON.parse(fileBody);
            if (parsedFileBody.success) {
              if (++roundRobin >= FILE_SERVERS.length) {
                roundRobin = 0;
              }
              return res.status(200).send({ success: true, message: fileName + " successfully uploaded."});
            } else {
              return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName });
            }
          } else {
            return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName });
          }
        });
      }
    });
  });
});

clusterServer.get('/download', (req, res) => {
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
      db.all("SELECT * FROM directory WHERE file_name=?", fileName, (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).send({ success: false, message: "Failed to download " + fileName + err });
        }
        if (rows[0] && rows.length === 1 && rows[0].file_name === fileName) {
          const fileServerIP = rows[0].server_ip;
          const encodedFileName = querystring.stringify({ fileName });
          console.log("Download requested for " + fileName);
          res.header('x-access-token', token);
          return res.redirect('http://' + fileServerIP + '/download?' + encodedFileName);
        } else {
          return res.status(404).send({ success: false, message: fileName + " could not be found in the system." });
        }
      });
    } else {
      return res.status(400).send({ success: false, message: "No file name provided."});
    }
  });
});

clusterServer.get('/delete', (req, res) => {
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(401).send({ success: false, message: 'No token provided.' });
  }
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).send({ success: false, message: 'Failed to authenticate token ' + err });
    }
    if (req.query.fileName) {
      const fileName = req.query.fileName;
      db.all("SELECT * FROM directory WHERE file_name=?", fileName, (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).send({ success: false, message: "Failed to delete " + fileName + err });
        }
        if (rows[0] && rows.length === 1 && rows[0].file_name === fileName) {
          const fileServerIP = rows[0].server_ip;
          const encodedFileName = querystring.stringify({ fileName });
          console.log("Delete requested for " + fileName);
          db.run("DELETE FROM directory WHERE file_name=?", fileName, (err) => {
            if (err) {
              console.error(err);
              return res.status(500).send({ success: false, message: "Failed to delete " + fileName + err });
            }
          });
          res.header('x-access-token', token);
          return res.redirect('http://' + fileServerIP + '/delete?' + encodedFileName);
        } else {
          return res.status(404).send({ success: false, message: fileName + " could not be found in the system." });
        }
      });
    } else {
      return res.status(400).send({ success: false, message: "No file name provided."});
    }
  });
});

clusterServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Cluster server failed to start.', err);
  }
  console.log(`Cluster server listening on port ${PORT}.`);
});
