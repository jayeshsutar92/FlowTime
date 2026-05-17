#!/bin/sh
set -e

python wait_for_db.py
python manage.py migrate --noinput

exec "$@"
