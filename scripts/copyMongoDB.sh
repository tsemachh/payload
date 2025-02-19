#!/bin/bash

# Export connection strings (avoid double quotes)
export mongo1="mongodb+srv://channahk:eadDVXob0UnZ2DZE@cluster0.einyx.mongodb.net/"
export mongo2="mongodb://localhost:27017"

# Step 1: Take a dump from mongo1
./bin/mongodump --uri $mongo1 --gzip --archive=./dump/backupFile.gz

# Step 2: Restore the dump to mongo2 (use $mongo2)
./bin/mongorestore --uri $mongo2 --gzip --archive=./dump/backupFile.gz

# Clean up: Remove the backup file (optional)
rm ./dump/backupFile.gz
