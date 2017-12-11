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

const PORT = 8070;
const TMPDIR = './tmp';
//This secret is just used for testing purposes. In production, use environment variable.
const SECRET = 'yallmothafuckasneedjesus';
var db = new sqlite3.Database('AUTH.db', (err) => {
  if (err) {
    console.error(err.message)
  }
  console.log("Connected to SQLite database.");
});
db.run("CREATE TABLE IF NOT EXISTS user (email TEXT PRIMARY KEY, password TEXT NOT NULL, token)");

if (!fs.existsSync(TMPDIR)) {
  fs.mkdirSync(TMPDIR);
}

var authServer = express();
authServer.use(bodyParser.urlencoded({ extended: false }));
authServer.use(bodyParser.json());

authServer.post('/authenticate', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  db.all("SELECT email, password FROM user WHERE email=?", email, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send({ success: false, message: 'Failed to authenticate.' + err});;;
    }
    const userRow = rows.filter((row) => {
      return row.email === email;
    });
    if (userRow.length === 1) {
      const isPasswordValid = bcrypt.compareSync(password, userRow[0].password);
      if (isPasswordValid) {
        const token = jwt.sign({ email }, SECRET, { expiresIn: 86400 });
        console.log(email + " was authenticated successfully.");
        return res.status(200).send({ success: true, message: email + ' successfully logged in.', token });
      } else {
        return res.status(401).send({ success: false, message: 'Invalid password.' });
      }
    } else {
      return res.status(400).send({ success: false, message: 'User ' + email + ' does not exist.' });
    }
  });
});

authServer.post('/register', (req, res) => {
  const email = req.body.email;
  const hashedUserPassword = bcrypt.hashSync(req.body.password, 8);
  db.all("SELECT email FROM user WHERE email=?", email, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send({ success: false, message: 'Failed to register.' + err });
    }
    const userRow = rows.filter((row) => {
      return row.email === email;
    });
    if (userRow.length === 0) {
      var stmt = db.prepare('INSERT INTO user (email, password) VALUES (?, ?)');
      stmt.run(email, hashedUserPassword);
      stmt.finalize();
      console.log(email + " registered succesfully.");
      return res.status(200).send({ success: true, message: email + " registered succesfully." });
    } else {
      return res.status(400).send({ success: false, message: email + " already exists." });
    }
  });
});

authServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Authentication server failed to start.', err);
  }
  console.log(`Authentication server listening on port ${PORT}.`);
});
