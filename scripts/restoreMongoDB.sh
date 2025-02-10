#!/bin/bash
# Export connection strings (avoid double quotes)
export mongo2='mongodb+srv://rachel:wyjWKJGwIhNe4oTj@emda-cluster.szhfx.mongodb.net/'
# Step 1: Take a dump from mongo1
# Step 2: Restore the dump to mongo2 (use $mongo2)
mongorestore --uri $mongo2 --gzip --archive=./dump/backupFile.gz
# Clean up: Remove the backup file (optional)
