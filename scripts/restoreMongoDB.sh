#!/bin/bash

# Export connection strings (avoid double quotes)
export mongo2=""mongodb://localhost:27017""

# Step 2: Restore the dump to mongo2 (use $mongo2)
mongorestore --uri $mongo2 --gzip --archive=./dump/backupFile.gz

