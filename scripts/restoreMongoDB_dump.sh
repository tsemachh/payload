#!/usr/bin/env bash
set -euo pipefail

# restoreMongoDB_dump.sh
#
# 1) Dumps two collections from a source MongoDB
# 2) Drops the same collections on the destination (localhost by default)
# 3) Restores into the destination
# 4) Removes 'migrateAll' entry from payload-migrations on destination
#
# Requirements: mongodump, mongorestore, mongosh
#
# Usage examples:
#   ./restoreMongoDB_dump.sh \
#     --src "mongodb+srv://user:pass@cluster0.x.mongodb.net/sourceDb" \
#     --dst "mongodb://localhost:27017" \
#     --src-db sourceDb \
#     --dst-db targetDb \
#     -y
#
#   ./restoreMongoDB_dump.sh \
#     --src "mongodb://user:pass@remote-host:27017/?authSource=admin" \
#     --dst "mongodb://localhost:27017" \
#     --db mydb \
#     -y

SRC_URI=""
DST_URI="mongodb://localhost:27017"
DB_NAME=""           # if provided, used for both src and dst
SRC_DB_NAME=""
DST_DB_NAME=""
AUTO_YES=""

# Collections we manage
COLL_USERS="users"
COLL_MIGRATIONS="payload-migrations"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --src) SRC_URI="$2"; shift 2;;
    --dst) DST_URI="$2"; shift 2;;
    --db) DB_NAME="$2"; shift 2;;
    --src-db) SRC_DB_NAME="$2"; shift 2;;
    --dst-db) DST_DB_NAME="$2"; shift 2;;
    -y|--yes) AUTO_YES=1; shift;;
    *) echo "Unknown argument: $1" >&2; exit 1;;
  esac
done

if [[ -z "$SRC_URI" ]]; then
  echo "ERROR: --src is required (source MongoDB URI)." >&2
  exit 1
fi

if [[ -n "$DB_NAME" ]]; then
  SRC_DB_NAME=${SRC_DB_NAME:-$DB_NAME}
  DST_DB_NAME=${DST_DB_NAME:-$DB_NAME}
fi

if [[ -z "$SRC_DB_NAME" || -z "$DST_DB_NAME" ]]; then
  echo "ERROR: set --db <name> or both --src-db and --dst-db." >&2
  exit 1
fi

for bin in mongodump mongorestore mongosh; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin not found in PATH. Install MongoDB Database Tools." >&2
    exit 1
  fi
done

if [[ -z "$AUTO_YES" ]]; then
  echo "This will MODIFY destination: $DST_URI/$DST_DB_NAME"
  echo "- Collections: $COLL_USERS, $COLL_MIGRATIONS will be dropped and restored"
  echo "- Source: $SRC_URI (db '$SRC_DB_NAME')"
  read -r -p "Proceed? (y/N) " ans
  if [[ ! "$ans" =~ ^[Yy]$ ]]; then
    echo "Aborted."; exit 1
  fi
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

DUMP_DIR="$TMPDIR/dump"
mkdir -p "$DUMP_DIR"

echo "[1/5] Dumping from source ($SRC_URI/$SRC_DB_NAME) ..."
# Dump only the two collections
mongodump \
  --uri "$SRC_URI" \
  --db "$SRC_DB_NAME" \
  --collection users \
  --archive="./dump/backupFileUsers.gz" \
  --gzip

mongodump \
  --uri "$SRC_URI" \
  --db "$SRC_DB_NAME" \
  --collection payload-migrations \
  --archive="./dump/backupFileMigrations.gz" \
  --gzip

# Safety: drop only the target collections on destination
echo "[2/5] Dropping destination collections on $DST_URI/$DST_DB_NAME ..."
mongosh "$DST_URI" --quiet --eval "
  const dbx = db.getSiblingDB('$DST_DB_NAME');
  const cols = ['$COLL_USERS', '$COLL_MIGRATIONS'];
  for (const c of cols) {
    try {
      if (dbx.getCollection(c).exists()) dbx.getCollection(c).drop();
    } catch (e) { /* ignore */ }
  }
  print('Dropped if existed: ' + cols.join(', '));
" >/dev/null

# Restore with --nsInclude to map source DB to destination DB safely
# [3/5] Restoring the two collections from the dump into destination ...
# Option A: restore only these two namespaces from the archive
mongorestore \
  --uri "$DST_URI" \
  --archive="./dump/backupFileMigrations.gz" \
  --gzip \
  --nsInclude "$SRC_DB_NAME.users" \
  --nsInclude "$SRC_DB_NAME.payload-migrations" \
  --nsFrom "$SRC_DB_NAME.*" \
  --nsTo   "$DST_DB_NAME.*"

mongorestore \
  --uri "$DST_URI" \
  --archive="./dump/backupFileUsers.gz" \
  --gzip \
  --nsInclude "$SRC_DB_NAME.users" \
  --nsFrom "$SRC_DB_NAME.*" \
  --nsTo   "$DST_DB_NAME.*"

# Post-restore cleanup
echo "[4/5] Removing 'migrateAll' entries from '$COLL_MIGRATIONS' ..."
mongosh "$DST_URI" --quiet --eval "
  const dbx = db.getSiblingDB('$DST_DB_NAME');
  const coll = dbx.getCollection('$COLL_MIGRATIONS');
  const filter = { \$or: [
    { name: 'migrateAll' },
    { slug: 'migrateAll' },
    { key: 'migrateAll' },
    { migration: 'migrateAll' },
    { migrationName: 'migrateAll' },
    { id: 'migrateAll' }
  ] };
  const res = coll.deleteMany(filter);
  print('Deleted count from payload-migrations: ' + res.deletedCount);
" >/dev/null

echo "[5/5] Done."
