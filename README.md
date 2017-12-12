# Ganja File System (CS4400 Individual Project Task)
### By Jerico Alcaras, 14317110
## Run using NPM	
This service requires **Node** and **NPM** in order to run (built and tested using Node 8.2.1 and NPM 5.5.1).
# Ganja File System (CS4400 Individual Project Task)
### By Jerico Alcaras, 14317110
## Run using NPM
This service requires **Node** and **NPM** in order to run.
### Windows
1. Clone the repository.
2. Run `start-win.bat`. This runs all the servers by executing their respective `npm start` scripts (make sure your Node installation is at C:/Program Files/nodejs). Five command prompts should appear.
3. Connect to `localhost:8080` and use the routes as described in `docs/ganja-API.pdf`.
### Linux/Mac
COMING SOON LOL
## Architecture
COMING SOON LOL
## Features
### Distributed Transparent File Access
* Upload (with overwrite option) and download system.
* All files are identified by their name.
* Files are stored by instances of `ganja-file-server` in their respective `data` folders.
### Security Service
* On successful login, a JSON web token is returned that must be used in the `x-access-token` header for every HTTP request sent to all routes.
### Directory Service
* Flat file system, each successfully uploaded file will have a server IP associated with it.
* Implemented at `ganja-web-server` and `ganja-cluster-server` using local SQLite databases.
* At the `ganja-web-server` level, each file will have an IP address of a `ganja-cluster-server`.
* At the `ganja-cluster-server` level, each file will have an IP address of a `ganja-file-server`, where it is physically stored.
### Replication
* `ganja-web-server` is connected to multiple instances of `ganja-cluster-server`, and each `ganja-cluster-server` is connected to multiple instances of `ganja-file-server`.
* Files are stored using a round-robin protocol, but this can be easily changed such that files are replicated across instances of `ganja-cluster-server`.
### Caching
* Caching is implemented at the `ganja-web-server` level using Cacheman (https://www.npmjs.com/package/cacheman).
* Every upload is cached for faster download, with a TTL of 5 minutes.
### Transactions
* COMING SOON LOL
### Lock Service
* Lock-lease system, provided by `ganja-lock-server`.
* Implemented using a key-value system with TTL using Cacheman (https://www.npmjs.com/package/cacheman).
* A lock request can have a user-defined lock time.
* Maximum lock time is 24 hours.
* Default lock time is 60 seconds if a lock time is not provided by the user.