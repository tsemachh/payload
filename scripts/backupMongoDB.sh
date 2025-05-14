#!/bin/bash

# Export connection strings (avoid double quotes)
export mongo1="mongodb://localhost:27017"

# Step 1: Take a dump from mongo1
./bin/mongodump --uri $mongo1 --gzip --archive=./dump/backupFile.gz

