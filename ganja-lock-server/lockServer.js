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

const PORT = 8071;
const TMPDIR = './tmp';
const AUTH_SERVER = '127.0.0.1:8070';
//This secret is just used for testing purposes. In production, use environment variable.
const SECRET = 'yallmothafuckasneedjesus';

if (!fs.existsSync(TMPDIR)) {
  fs.mkdirSync(TMPDIR);
}

//TODO Implement cache-style locking service.

var lockServer = express();
lockServer.use(bodyParser.urlencoded({ extended: false }));
lockServer.use(bodyParser.json());

webServer.get('/lock', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  //TODO
});

webServer.get('/unlock', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  //TODO
});

webServer.get('/checkForLock', (req, res) => {
  const clientLog = "[" + req.ip + "] ";
  //TODO
});

lockServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Lock server failed to start.', err);
  }
  console.log(`Lock server listening on port ${PORT}.`);
});
