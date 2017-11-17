const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');

const PORT = 8080;
const STUDENT_NUMBER = 14317110;
const DATADIR = './data';

const fileServer = express();

if (!fs.existsSync(DATADIR)) {
    fs.mkdirSync(DATADIR);
}

fileServer.get('/write', (request, response) => {
  response.send('Hello from Express!')
})

fileServer.get('/read', (request, response) => {
  response.sendFile('test.jpg', { root: path.join(__dirname, './data') });
})

fileServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Something bad happened.', err)
  }
  console.log(`File server listening on 0.0.0.0:${PORT}`)
})
