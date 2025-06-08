#!/bin/bash
# Export connection strings (avoid double quotes)
export mongo2="mongodb://localhost:27017"
#export mongo2="mongodb+srv://app:DuChQfEVyjQMiW6K@emda-dev-cluster.auybqem.mongodb.net/"

# Step 2: Restore the dump to mongo2 with optimized performance
./bin/mongorestore --uri $mongo2 --gzip  --numInsertionWorkersPerCollection=4  --archive=./dump/backupFile.gz

