#$env:mongo1 = "mongodb+srv://ORIGINAL:B1z028sXLwJEwIrb@payload.jzohyre.mongodb.net/"       
#$env:mongo2 = "mongodb+srv://TARGET:xzXlFESgMTKCiniY@cmweb2dev.my3mh3f.mongodb.net/"
# Add MongoDB Tools directory to PATH
$toolsPath = "C:\Program Files\MongoDB\Tools\100\bin"
$env:Path += ";$toolsPath"

# Step 1: Take a dump from mongo1
mongodump --uri $env:mongo1  --gzip --archive=./dump/backupFile.gz

# Step 2: Restore the dump to mongo2
mongorestore --uri $env:mongo2 --gzip --archive=./dump/backupFile.gz

# Clean up: Remove the backup file (optional)
#Remove-Item ./dump/backupFile.gz