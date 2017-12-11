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
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const PORT = 8080;
const TMPDIR = './tmp';
const CLUSTER_SERVERS = ['127.0.0.1:8081', '127.0.0.1:8082', '127.0.0.1:8083'];
const AUTH_SERVER = '127.0.0.1:8070';
const LOCK_SERVER = '127.0.0.1:8071';
//This secret is just used for testing purposes. In production, use environment variable.
const SECRET = 'yallmothafuckasneedjesus';
var roundRobin = 0;
var db = new sqlite3.Database('WEB.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to SQLite database.");
});
db.run("CREATE TABLE IF NOT EXISTS directory (file_name TEXT PRIMARY KEY, server_ip TEXT NOT NULL, lockable INTEGER NOT NULL DEFAULT 0)");

if (!fs.existsSync(TMPDIR)) {
  fs.mkdirSync(TMPDIR);
}

var webServer = express();
webServer.use(bodyParser.urlencoded({ extended: false }));
webServer.use(bodyParser.json());

webServer.get('/files', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  db.all("SELECT * FROM directory", (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send({ success: false, message: 'Failed to get a listing of files.' + err });
    }
    res.write("<h1>Ganja File System</h1>");
    res.write("<h2>Files currently in server</h2>");
    rows.forEach((row) => {
      const encodedFileName = querystring.stringify({ fileName: row.file_name });
      console.log(row);
      res.write("<br>" + row.file_name + (row.lockable === 1 ? " LOCKABLE" : "") + "</br>");
    });
    return res.end();
  });
});

webServer.post('/login', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  if (!req.body.email || !req.body.password) {
    return res.status(400).send({ success: false, message: "No email and/or password provided." });
  }
  console.log(clientLog + "Login initiated for " + req.body.email);
  return res.redirect(307, 'http://' + AUTH_SERVER + '/authenticate');
});

webServer.post('/register', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  if (!req.body.email || !req.body.password) {
    return res.status(400).send({ success: false, message: "No email and/or password provided." });
  }
  console.log(clientLog + "Registration initiated for " + req.body.email);
  return res.redirect(307, 'http://' + AUTH_SERVER + '/register');
});

webServer.post('/upload', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(401).send({ success: false, message: 'No token provided.' });
  }
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).send({ success: false, message: 'Failed to authenticate token.' });
    }
    var reqForm = new formidable.IncomingForm();
    if (!reqForm) {
      return res.status(400).send({ success: false, message: "No multipart/form-data detected with request."});
    }
    reqForm.parse(req, (err, fields, files) => {
      if (!files.file || !fields.lockable || !fields.overwrite) {
        return res.status(400).send({ success: false, message: "Form must contain:\n file: File\nlockable: boolean,\noverwrite: boolean" });
      }

      const localPath = files.file.path;
      const lockable = fields.lockable;
      const overwrite = fields.overwrite;
      const fileName = files.file.name;
      const form = {
        file: fs.createReadStream(localPath),
        fileName: fileName,
        clusterServerID: roundRobin,
        overwrite: overwrite,
      };
      db.all("SELECT * FROM directory WHERE file_name=?", fileName, (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName + err });
        }
        const fileRows = rows.filter((row) => {
          return row.file_name === fileName;
        });
        if (fileRows.length === 0) {
          var stmt = db.prepare('INSERT INTO directory (file_name, server_ip, lockable) VALUES (?, ?, ?)');
          stmt.run(fileName, CLUSTER_SERVERS[roundRobin], lockable ? 1 : 0);
          stmt.finalize();
          console.log(clientLog + "Upload requested for " + fileName)
          request.post({ url: 'http://' + CLUSTER_SERVERS[roundRobin] + '/upload', formData: form }, (err, clusterRes, clusterBody) => {
            if (err) {
              console.error(err);
              return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName + err});
            }
            if (clusterBody) {
              const parsedClusterBody = JSON.parse(clusterBody);
              if (parsedClusterBody.success) {
                if (++roundRobin >= CLUSTER_SERVERS.length) {
                  roundRobin = 0;
                }
                return res.status(200).send({ success: true, message: fileName + " successfully uploaded." + (lockable ? " (LOCKABLE)" : "")});
              } else {
                return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName });
              }
            } else {
              return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName });
            }
          });
        } else if (fileRows.length === 1) {
          //check for lock
          if (overwrite === 'true') {
            console.log(clientLog + "Upload with overwrite requested for " + fileName)
            request.post({ url: 'http://' + fileRows[0].server_ip + '/upload', formData: form }, (err, clusterRes, clusterBody) => {
              if (err) {
                console.error(err);
                return res.status(500).send({ success: false, message: 'Failed to overwrite ' + fileName + err});;
              }
              if (clusterBody) {
                const parsedClusterBody = JSON.parse(clusterBody);
                if (parsedClusterBody.success) {
                  if (++roundRobin >= CLUSTER_SERVERS.length) {
                    roundRobin = 0;
                  }
                  return res.status(200).send({ success: true, message: fileName + " successfully overwritten." + (lockable ? " (LOCKABLE)" : "")});
                } else {
                  return res.status(500).send({ success: false, message: 'Failed to overwrite ' + fileName });
                }
              } else {
                return res.status(500).send({ success: false, message: 'Failed to overwrite ' + fileName });
              }
            });
          } else {
            return res.status(400).send({ success: false, message: fileName + " already exists. Pass overwrite: true in your POST request body (multipart/form-data) to overwrite the existing file." });
          }
        } else {
          return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName });
        }
      });
    });
  });
});

webServer.delete('/files/:fileName', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(401).send({ success: false, message: 'No token provided.' });
  }
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).send({ success: false, message: 'Failed to authenticate token.' });
    }
    if (req.params.fileName) {
      const fileName = req.params.fileName;
      db.all("SELECT * FROM directory WHERE file_name=?", fileName, (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).send({ success: false, message: "Failed to delete " + fileName + err });
        }
        if (rows[0] && rows.length === 1 && rows[0].file_name === fileName) {
          const clientLog = "[" + req.ip + "] ";
          const clusterServerIP = rows[0].server_ip;
          const encodedFileName = querystring.stringify({ fileName });
          console.log(clientLog + "Delete requested for " + fileName);
          db.run("DELETE FROM directory WHERE file_name=?", fileName, (err) => {
            if (err) {
              console.error(err);
              return res.status(500).send({ success: false, message: "Failed to delete " + fileName + err });
            }
          });
          res.header('x-access-token', token);
          return res.redirect('http://' + clusterServerIP + '/delete?' + encodedFileName);
        } else {
          return res.status(404).send({ success: false, message: fileName + " could not be found in the system." });
        }
      });
    } else {
      return res.status(400).send({ success: false, message: "No file name provided." });
    }
  });
});

webServer.get('/files/:fileName', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(401).send({ success: false, message: 'No token provided.' });
  }
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).send({ success: false, message: 'Failed to authenticate token.' });
    }
    if (req.params.fileName) {
      const fileName = req.params.fileName;
      db.all("SELECT * FROM directory WHERE file_name=?", fileName, (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).send({ success: false, message: "Failed to download " + fileName + err });
        }
        if (rows[0] && rows.length === 1 && rows[0].file_name === fileName) {
          const clusterServerIP = rows[0].server_ip;
          const encodedFileName = querystring.stringify({ fileName });
          console.log(clientLog + "Download requested for " + fileName);
          res.header('x-access-token', token);
          return res.redirect('http://' + clusterServerIP + '/download?' + encodedFileName);
        } else {
          return res.status(404).send({ success: false, message: fileName + " could not be found in the system." });
        }
      });
    } else {
      return res.status(400).send({ success: false, message: "No file name provided." });
    }
  });
});

webServer.get('/lock', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
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
      const lockTime = req.query.lockTime;
      db.all("SELECT * FROM directory WHERE file_name=?", fileName, (err, rows) => {
        if (err) {
          console.error(err);
        }
        if (rows[0] && rows.length === 1 && rows[0].file_name === fileName) {
          const encodedFileName = querystring.stringify({ fileName });
          const encodedLockTime = querystring.stringify({ lockTime });
          console.log(clientLog + "Lock requested for " + fileName);
          res.header('x-access-token', token);
          return res.redirect('http://' + LOCK_SERVER + '/lock?' + encodedFileName + '&' + encodedLockTime);
        } else {
          return res.status(404).send({ success: false, message: fileName + " could not be found in the system." });
        }
      });
    } else {
      return res.status(400).send({ success: false, message: "No file name provided." });
    }
  });
});

webServer.get('/unlock', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
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
        }
        if (rows[0] && rows.length === 1 && rows[0].file_name === fileName) {
          const encodedFileName = querystring.stringify({ fileName });
          console.log(clientLog + "Unlock requested for " + fileName);
          res.header('x-access-token', token);
          return res.redirect('http://' + LOCK_SERVER + '/unlock?' + encodedFileName);
        } else {
          return res.status(404).send({ success: false, message: fileName + " could not be found in the system." });
        }
      });
    } else {
      return res.status(400).send({ success: false, message: "No file name provided." });
    }
  });
});

webServer.get('/checkForLock', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
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
        }
        if (rows[0] && rows.length === 1 && rows[0].file_name === fileName) {
          const encodedFileName = querystring.stringify({ fileName });
          console.log(clientLog + "Check for lock requested for " + fileName);
          res.header('x-access-token', token);
          return res.redirect('http://' + LOCK_SERVER + '/checkForLock?' + encodedFileName);
        } else {
          return res.status(404).send({ success: false, message: fileName + " could not be found in the system." });
        }
      });
    } else {
      return res.status(400).send({ success: false, message: "No file name provided." });
    }
  });
});

webServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Web server failed to start.', err);
  }
  console.log(`Web server listening on port ${PORT}.`);
});
