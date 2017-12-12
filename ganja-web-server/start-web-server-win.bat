@echo off
set NodePackagesPath=C:\Program Files\nodejs
set Path=%NodePackagesPath%\node_modules\.bin;%PATH%
set Path=%NodePackagesPath%;%PATH%
set NODE_PATH=%NodePackagesPath%\node_modules;%NODE_PATH%
set NODE_ENV=production
echo Environment variables successfully added.
npm install && npm start