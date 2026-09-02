#!/bin/bash
set -e

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate a timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backups/flowtime_db_$TIMESTAMP.sql"

echo "Backing up FlowTime database to $BACKUP_FILE..."

# Execute pg_dump inside the db container
docker compose exec -T db pg_dump -U flowtime -d flowtime > "$BACKUP_FILE"

echo "Backup successful! Size: $(du -h $BACKUP_FILE | cut -f1)"
echo "IMPORTANT: Keep this file safe. To restore, use scripts/restore_db.sh $BACKUP_FILE"
