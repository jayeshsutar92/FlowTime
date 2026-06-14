import logging

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

ADMIN_USERNAME = "flowadmin"
ADMIN_EMAIL = "admin@flowtime.local"
ADMIN_PASSWORD = "FlowAdmin@2024!"


class Command(BaseCommand):
    help = "Create the default admin account if it does not already exist."

    def handle(self, *args, **options):
        User = get_user_model()

        if User.objects.filter(username=ADMIN_USERNAME).exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Default admin '{ADMIN_USERNAME}' already exists. Skipping creation."
                )
            )
            self.stdout.write(
                self.style.NOTICE(
                    f"  Username : {ADMIN_USERNAME}\n"
                    f"  Email    : {ADMIN_EMAIL}\n"
                    f"  To change password run: python manage.py changepassword {ADMIN_USERNAME}"
                )
            )
            return

        User.objects.create_superuser(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password=ADMIN_PASSWORD,
        )

        self.stdout.write(self.style.SUCCESS("Default admin account created:"))
        self.stdout.write(
            f"  Username : {ADMIN_USERNAME}\n"
            f"  Email    : {ADMIN_EMAIL}\n"
            f"  Password : {ADMIN_PASSWORD}\n"
            f"  To change password later: python manage.py changepassword {ADMIN_USERNAME}"
        )
