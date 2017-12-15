# Ganja File System (CS4400 Individual Project Task)
### By Jerico Alcaras, 14317110
## Run using NPM
This service requires **Node** and **NPM** in order to run  (built and tested using Node 8.2.1 and NPM 5.5.1).
### Windows
1. Clone the repository.
2. Run `start-win.bat`. This runs all the servers by executing their respective `npm start` scripts (make sure your Node installation is at C:/Program Files/nodejs). Five command prompts should appear and start installing Node modules, then start instances of each server.
3. Connect to `localhost:8080` and use the routes as described in `docs/ganja-API.pdf`.
### Linux/Mac
COMING SOON LOL
## Architecture
![Diagram](docs/ganja-architecture-diagram.png)
## Features
### Distributed Transparent File Access
* Upload (with overwrite option), delete and download system.
* All files are uniquely identified by their name.
* Files are stored by instances of `ganja-file-server` in their respective `data` folders.
### Security Service
* Authentication and authorization, provided by `ganja-auth-server` using JWT (https://www.npmjs.com/package/jwt).
* On successful login, a JSON web token is returned that must be used in the `x-access-token` header for every HTTP request sent to all routes.
### Directory Service
* Flat file system, each successfully uploaded file will have the IP address of a `ganja-file-server` associated with it.
* Implemented at the `ganja-cluster-server` level using local SQLite databases.
### Replication
* `ganja-web-server` is connected to multiple instances of `ganja-cluster-server`, and each `ganja-cluster-server` is connected to multiple instances of `ganja-file-server`.
* Files are uploaded, overwritten and deleted at all clusters. 
* File downloads are served via round-robin on instances of `ganja-cluster-server` as a naive form of load-balancing.  
### Caching
* Caching is implemented at the `ganja-web-server` level using Cacheman (https://www.npmjs.com/package/cacheman).
* Every upload is cached for faster download, with a TTL of 5 minutes.
### Transactions
* COMING SOON (IN 1000 YEARS) LOL
### Lock Service
* Lock-lease system, provided by `ganja-lock-server`, implemented using a key-value, cache-style system with TTL using Cacheman (https://www.npmjs.com/package/cacheman).
* The user who has a lock on a file can modify it. Other users cannot modify it until this lock expires.
* A lock request can have a user-defined lock time.
* Maximum lock time is 24 hours.
* Default lock time is 60 seconds if a lock time is not provided by the user.
