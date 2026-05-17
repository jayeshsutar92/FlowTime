import os
import sys
import time

import django
from django.db import OperationalError, connections


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")


def wait_for_database() -> None:
    django.setup()
    max_attempts = int(os.getenv("DB_WAIT_ATTEMPTS", "30"))
    delay = float(os.getenv("DB_WAIT_DELAY", "2"))

    for attempt in range(1, max_attempts + 1):
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT 1")
            print("Database is ready.")
            return
        except OperationalError as exc:
            if attempt == max_attempts:
                print(f"Database is not ready after {max_attempts} attempts: {exc}", file=sys.stderr)
                raise

            print(f"Waiting for database... attempt {attempt}/{max_attempts}")
            time.sleep(delay)


if __name__ == "__main__":
    wait_for_database()
