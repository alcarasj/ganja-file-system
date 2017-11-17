const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const fileUpload = require('express-fileupload');

const PORT = 8080;
const STUDENT_NUMBER = 14317110;
const DIR = './data';
const DATADIR = '/data/';

const fileServer = express();
fileServer.use(fileUpload());

if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR);
}

fileServer.post('/write', (request, response) => {
  if (!request.files) {
     return response.status(400).send('No files were uploaded.');
  } else {
    var fileName = request.param('fileName');
    if (fs.existsSync(DATADIR + fileName)) {
      console.log('Found file.');
      //Overwrite
    } else {
      //Create
      fs.writeFile(DATADIR + fileName, (err) => {
        if (err) {
            return console.log(err);
        }

        console.log("The file was saved!");
        });
    }
  }
});

fileServer.get('/read', (request, response) => {
  response.sendFile('test.jpg', { root: path.join(__dirname, './data') });
});

fileServer.listen(PORT, (err) => {
  if (err) {
    return console.log('Something bad happened.', err)
  }
  console.log(`File server listening on 0.0.0.0:${PORT}`)
});
