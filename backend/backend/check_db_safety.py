import os
import sys
import django
from django.db import connections
from django.db.utils import OperationalError

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

def check_safety():
    django.setup()
    
    expect_existing = os.getenv("EXPECT_EXISTING_DB", "true").lower() == "true"
    
    if not expect_existing:
        print("Safety check: EXPECT_EXISTING_DB is false. Proceeding with database initialization/migrations.")
        return

    print("Safety check: EXPECT_EXISTING_DB is true. Verifying database state...")
    try:
        with connections["default"].cursor() as cursor:
            # Check if the auth_user table exists
            cursor.execute("SELECT to_regclass('public.auth_user');")
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                print(
                    "\n[FATAL ERROR] The database appears to be completely empty (auth_user table missing), "
                    "but EXPECT_EXISTING_DB is set to 'true'.\n"
                    "This usually means you've connected to a fresh database or accidentally deleted your Docker volume.\n"
                    "To prevent automatically wiping/overwriting data or assuming a fresh start, startup has been aborted.\n"
                    "If you intentionally want to initialize a fresh database, set EXPECT_EXISTING_DB=false in docker-compose.yml.\n",
                    file=sys.stderr
                )
                sys.exit(1)
            
            print("Safety check passed: Database contains expected tables.")
    except OperationalError as exc:
        print(f"\n[FATAL ERROR] Could not connect to the database to perform safety check: {exc}\n", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    check_safety()
