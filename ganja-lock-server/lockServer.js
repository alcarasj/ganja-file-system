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
const Cacheman = require('cacheman');

const PORT = 8071;
const TMPDIR = './tmp';
const AUTH_SERVER = '127.0.0.1:8070';
//This secret is just used for testing purposes. In production, use environment variable.
const SECRET = 'yallmothafuckasneedjesus';
const MAX_LOCK_TIME = 86400;
const DEFAULT_LOCK_TIME = 60;
const LOCKLOG = '[LOCK] ';
const UNLOCKLOG = '[UNLOCK] ';

if (!fs.existsSync(TMPDIR)) {
  fs.mkdirSync(TMPDIR);
}

var fileLocks = new Cacheman({ ttl: DEFAULT_LOCK_TIME });
var lockServer = express();
lockServer.use(bodyParser.urlencoded({ extended: false }));
lockServer.use(bodyParser.json());

lockServer.get('/lock', (req, res) => {
  const fileName = req.query.fileName;
  const lockTimeInSeconds = req.query.lockTimeInSeconds ? parseInt(req.query.lockTimeInSeconds) : DEFAULT_LOCK_TIME;
  fileLocks.get(fileName, (err, value) => {
    if (err) {
      console.error(err);
      return res.sendStatus(500);
    }
    if (value) {
      return res.status(400).send({ success: false, message: "This file has already been locked."});
    } else {
      if (lockTimeInSeconds && lockTimeInSeconds > 86400) {
        return res.status(400).send({ success: false, message: "Lock time must not exceed " + MAX_LOCK_TIME + " seconds."});
      }
      fileLocks.set(fileName, { locked: true }, lockTimeInSeconds, (err, value) => {
        if (err) {
          console.error(err);
          return res.sendStatus(500);
        }
        if (value) {
          console.log(LOCKLOG + lockTimeInSeconds + " seconds on " + fileName);
          return res.status(200).send({ success: true, message: "Lock granted for " + fileName + " for " + (lockTimeInSeconds ? lockTimeInSeconds : DEFAULT_LOCK_TIME) + " seconds."});
        } else {
          return res.sendStatus(400);
        }
      });
    }
  });
});

lockServer.get('/unlock', (req, res) => {
  const fileName = req.query.fileName;
  fileLocks.get(fileName, (err, value) => {
    if (err) {
      console.error(err);
      return res.sendStatus(500);
    }
    if (value) {
      //delete entry
    } else {
      return res.status(400).send({ success: false, message: "There is no lock on this file."});
    }
  });
});

lockServer.get('/checkForLock', (req, res) => {
  const fileName = req.query.fileName;
  fileLocks.get(fileName, (err, value) => {
    if (err) {
      console.error(err);
    }
    console.log(value);
    if (value) {
      return res.status(200).send(value);
    } else {
      return res.status(200).send({ locked: false });
    }
  });
});

lockServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Lock server failed to start.', err);
  }
  console.log(`Lock server listening on port ${PORT}.`);
});
