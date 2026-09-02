# Database Management Scripts

This directory contains utility scripts to help manage your FlowTime database and prevent accidental data loss.

## The Danger of `docker compose down -v`

> [!WARNING]
> Running `docker compose down -v` or `docker-compose down -v` will **PERMANENTLY DELETE** the persistent volumes attached to the containers, including your PostgreSQL database. All your data (users, timers, analytics) will be lost if you haven't taken a backup.
> 
> Only run `docker compose down` (without the `-v` flag) to safely shut down containers without wiping data.

## Backing up your database

Before making destructive changes to Docker infrastructure or updating the application schema, you should back up your database:

```bash
bash scripts/backup_db.sh
```

This will create a `.sql` dump file in the `backups/` directory (e.g. `backups/flowtime_db_20260902_120000.sql`).

## Restoring your database

If you accidentally delete your volume or need to revert to an older state, you can restore a backup:

```bash
bash scripts/restore_db.sh backups/flowtime_db_20260902_120000.sql
```

> [!CAUTION]
> Restoring a database will completely overwrite the existing data in your currently running database.

## Built-in Startup Safeguard

To prevent the backend from initializing an empty database over what should be a populated instance, the `docker-compose.yml` is configured with `EXPECT_EXISTING_DB=true`. If the database is missing its primary tables, the backend container will refuse to start and print a fatal error to the logs.

If you intentionally want to initialize a fresh, empty database (e.g. for the very first setup), temporarily set `EXPECT_EXISTING_DB=false` in your `docker-compose.yml`, run `docker compose up -d`, and then change it back to `"true"`.
