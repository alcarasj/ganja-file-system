#!/bin/bash

cd ganja-lock-server
npm install
unameOut="$(uname -s)"
case "${unameOut}" in
    Linux*)     xterm -e "npm start" &;;
    Darwin*)    osascript -e 'tell application \"Terminal\" to do script \"npm start\"' &;;
    *)          machine="${unameOut} is not supported."
esac
cd ..
