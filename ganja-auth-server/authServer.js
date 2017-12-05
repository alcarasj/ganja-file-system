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

const PORT = 8080;
const TMPDIR = './tmp';
var db = new sqlite3.Database('database.db', (err) => {
  if (err) {
    console.error(err.message)
  }
  console.log("Connected to SQLite database.");
});
db.run("CREATE TABLE IF NOT EXISTS user (id INT PRIMARY KEY, email TEXT NOT NULL, password TEXT NOT NULLL)");

if (!fs.existsSync(TMPDIR)) {
  fs.mkdirSync(TMPDIR);
}

var authServer = express();
authServer.use(bodyParser.urlencoded({ extended: false }));
authServer.use(bodyParser.json());

authServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Authentication server failed to start.', err);
  }
  console.log(`Authentication server listening on port ${PORT}.`);
});
