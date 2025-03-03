#!/bin/bash

# Display usage information
usage() {
    echo "Usage: $0 [-d database] [collection1 collection2 ...]"
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -d DATABASE    Specify the database name (required)"
    echo ""
    echo "If no collections are specified, copies all collections from the specified database"
    echo "Example: $0 -d mydb users meetings"
    exit 1
}

# Check for help flag
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    usage
fi

# Parse command line arguments
database=""
collections=()
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--database)
            database="$2"
            shift 2
            ;;
        *)
            collections+=("$1")
            shift
            ;;
    esac
done

# Check if database is specified
if [ -z "$database" ]; then
    echo "Error: Database name is required"
    usage
fi

# Export connection strings (avoid double quotes)
export mongo2="mongodb://localhost:27017"
export mongo1="mongodb+srv://channahk:eadDVXob0UnZ2DZE@cluster0.einyx.mongodb.net/"

# Initialize collection parameters
collections_params=""
for collection in "${collections[@]}"; do
    collections_params="$collections_params --collection=$collection"
done

# Create dump directory if it doesn't exist
mkdir -p ./dump

# Step 1: Take a dump from mongo1
if [ -n "$collections_params" ]; then
    echo "Copying specific collections from database '$database': ${collections[*]}"
    ./bin/mongodump --uri $mongo1 --db $database $collections_params --gzip --archive=./dump/backupFile.gz
else
    echo "Copying all collections from database '$database'"
    ./bin/mongodump --uri $mongo1 --db $database --gzip --archive=./dump/backupFile.gz
fi

if [ $? -ne 0 ]; then
    echo "Error: mongodump failed"
    rm -f ./dump/backupFile.gz
    exit 1
fi

# Step 2: Restore the dump to mongo2 (use $mongo2)
./bin/mongorestore --uri $mongo2 --gzip --archive=./dump/backupFile.gz

if [ $? -ne 0 ]; then
    echo "Error: mongorestore failed"
    rm -f ./dump/backupFile.gz
    exit 1
fi

# Clean up: Remove the backup file (optional)
rm ./dump/backupFile.gz
