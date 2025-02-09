#!/bin/bash

# Export connection strings (avoid double quotes)
export mongo1="mongodb://localhost:27017"
export mongo2="mongodb://localhost:27017"

# Step 1: Take a dump from mongo1
mongodump --uri $mongo1 --gzip --archive=./dump/backupFile.gz

# Step 2: Restore the dump to mongo2 (use $mongo2)
mongorestore --uri $mongo2 --gzip --archive=./dump/backupFile.gz

# Clean up: Remove the backup file (optional)
rm ./dump/backupFile.gz
