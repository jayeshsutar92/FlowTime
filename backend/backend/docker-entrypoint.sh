#!/bin/sh
set -e

python wait_for_db.py
python check_db_safety.py
python manage.py migrate --noinput
python manage.py create_default_admin

exec "$@"
