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
const Cacheman = require('cacheman');

const PORT = 8080;
const TMPDIR = './tmp';
const CLUSTER_SERVERS = ['127.0.0.1:8081', '127.0.0.1:8082', '127.0.0.1:8083'];
const AUTH_SERVER = '127.0.0.1:8070';
const LOCK_SERVER = '127.0.0.1:8071';
const CACHE_TTL = 300;
//This secret is just used for testing purposes. In production, use environment variable.
const SECRET = 'yallmothafuckasneedjesus';
var roundRobin = 0;
var db = new sqlite3.Database('WEB.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to SQLite database.");
});
db.run("CREATE TABLE IF NOT EXISTS directory (file_name TEXT PRIMARY KEY, lockable INTEGER NOT NULL DEFAULT 0)");

if (!fs.existsSync(TMPDIR)) {
  fs.mkdirSync(TMPDIR);
}

var webServer = express();
var cache = new Cacheman({ ttl: CACHE_TTL });
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
          var stmt = db.prepare('INSERT INTO directory (file_name, lockable) VALUES (?, ?)');
          stmt.run(fileName, lockable ? 1 : 0);
          stmt.finalize();
          console.log(clientLog + "Upload requested for " + fileName);
          try {
            var uploads = 0;
            for (var i = 0; i < CLUSTER_SERVERS.length; i++) {
              request.post({ url: 'http://' + CLUSTER_SERVERS[i] + '/upload', formData: form }, (err, clusterRes, clusterBody) => {
                if (err) {
                  console.error(err);
                }
                if (clusterBody) {
                  const parsedClusterBody = JSON.parse(clusterBody);
                  if (parsedClusterBody.success) {
                    uploads++;
                  }
                  if (uploads === CLUSTER_SERVERS.length) {
                    cache.set(fileName, localPath, (err, value) => {
                      if (err) {
                        console.error(err);
                      }
                    });
                    return res.status(200).send({ success: true, message: fileName + " successfully uploaded to all clusters." + (lockable ? " (LOCKABLE)" : "")});
                  }
                }
              });
            }
          } catch (err) {
            return res.status(500).send({ success: false, message: 'Failed to upload ' + fileName + err });
          }
        } else if (fileRows.length === 1) {
          if (overwrite === 'true') {
            const encodedFileName = querystring.stringify({ fileName });
            request({ url: "http://" + LOCK_SERVER + "/checkForLock?" + encodedFileName, headers: { 'x-access-token': token } }, (err, lockRes, lockBody) => {
              if (err) {
                console.error(err);
              }
              if (lockRes) {
                const parsedLockBody = JSON.parse(lockBody);
                if (lockRes.statusCode === 200 && !parsedLockBody.modify) {
                  return res.status(400).send({ success: false, message: fileName + " is currently locked and cannot be overwritten." });
                } else if (lockRes.statusCode === 200 && parsedLockBody.modify) {
                  console.log(clientLog + "Upload with overwrite requested for " + fileName)
                  try {
                    var overwrites = 0;
                    for (var i = 0; i < CLUSTER_SERVERS.length; i++) {
                      request.post({ url: 'http://' + CLUSTER_SERVERS[i] + '/upload', formData: form }, (err, clusterRes, clusterBody) => {
                        if (err) {
                          console.error(err);
                        }
                        if (clusterBody) {
                          const parsedClusterBody = JSON.parse(clusterBody);
                          if (parsedClusterBody.success) {
                            overwrites++;
                          }
                          if (overwrites === CLUSTER_SERVERS.length) {
                            cache.set(fileName, localPath, (err, value) => {
                              if (err) {
                                console.error(err);
                              }
                            });
                            return res.status(200).send({ success: true, message: fileName + " successfully overwritten at all clusters." + (lockable ? " (LOCKABLE)" : "")});
                          }
                        }
                      });
                    }
                  } catch (err) {
                    return res.status(500).send({ success: false, message: 'Failed to overwrite ' + fileName + err });
                  }
                } else {
                  return res.status(500).send({ success: false, message: 'Failed to check for lock on ' + fileName + " for overwriting." });
                }
              } else {
                return res.status(500).send({ success: false, message: 'Failed to check for lock on ' + fileName + " for overwriting." });
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
          const encodedFileName = querystring.stringify({ fileName });
          request({ url: "http://" + LOCK_SERVER + "/checkForLock?" + encodedFileName, headers: { 'x-access-token': token } }, (err, lockRes, lockBody) => {
            if (err) {
              console.error(err)
            }
            if (lockRes) {
              const parsedLockBody = JSON.parse(lockBody);
              if (lockRes.statusCode === 200 && !parsedLockBody.modify) {
                return res.status(400).send({ success: false, message: fileName + " is currently locked and cannot be deleted." });
              } else if (lockRes.statusCode === 200 && parsedLockBody.modify) {
                const clientLog = "[" + req.ip + "] ";
                const encodedFileName = querystring.stringify({ fileName });
                console.log(clientLog + "Delete requested for " + fileName);
                db.run("DELETE FROM directory WHERE file_name=?", fileName, (err) => {
                  if (err) {
                    console.error(err);
                    return res.status(500).send({ success: false, message: "Failed to delete " + fileName + err });
                  }
                });
                res.header('x-access-token', token);
                cache.del(fileName, (err) => {
                  if (err) {
                    console.error(err);
                  }
                });
                try {
                  var deletes = 0;
                  for (var i = 0; i < CLUSTER_SERVERS.length; i++) {
                    request({ url: "http://" + CLUSTER_SERVERS[i] + "/delete?" + encodedFileName, headers: { 'x-access-token': token } }, (err, clusterRes, clusterBody) => {
                      if (err) {
                        console.error(err);
                      }
                      if (clusterRes && clusterRes.statusCode === 200) {
                        deletes++;
                      }
                      if (deletes === CLUSTER_SERVERS.length) {
                        return res.status(200).send({ success: true, message: fileName + " successfully deleted." });
                      }
                    });
                  }
                } catch (err) {
                  return res.status(500).send({ success: false, message: 'Failed to check for lock on ' + fileName + " for deletion." + err });
                }
              } else {
                return res.status(500).send({ success: false, message: 'Failed to check for lock on ' + fileName + " for deletion." });
              }
            } else {
              return res.status(500).send({ success: false, message: 'Failed to check for lock on ' + fileName + " for deletion." });
            }
          });
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
          if (++roundRobin >= CLUSTER_SERVERS.length) {
            roundRobin = 0;
          }
          const clusterServerIP = CLUSTER_SERVERS[roundRobin];
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
