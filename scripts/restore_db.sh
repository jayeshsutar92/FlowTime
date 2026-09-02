#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: scripts/restore_db.sh <path_to_sql_file>"
    echo "Example: scripts/restore_db.sh backups/flowtime_db_20260902_120000.sql"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: File $BACKUP_FILE does not exist."
    exit 1
fi

echo "WARNING: This will overwrite the current database with the contents of $BACKUP_FILE."
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 1
fi

echo "Restoring database from $BACKUP_FILE..."

# Drop the existing database and recreate it
docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS flowtime;"
docker compose exec -T db psql -U postgres -c "CREATE DATABASE flowtime OWNER flowtime;"

# Restore the dump
cat "$BACKUP_FILE" | docker compose exec -T db psql -U flowtime -d flowtime

echo "Restore successful!"
