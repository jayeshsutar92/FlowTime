from django.conf import settings
from django.db import models


class Session(models.Model):
    STATUS_RUNNING = "running"
    STATUS_PAUSED = "paused"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [
        (STATUS_RUNNING, "Running"),
        (STATUS_PAUSED, "Paused"),
        (STATUS_COMPLETED, "Completed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sessions",
        null=True,
        blank=True,
    )
    work_duration = models.IntegerField()
    break_duration = models.IntegerField()
    completed = models.BooleanField(default=False)
    total_sessions = models.IntegerField(default=1)
    current_session = models.IntegerField(default=1)
    paused_seconds = models.IntegerField(default=0)
    paused_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_RUNNING,
    )
    timer_type = models.CharField(
        max_length=20,
        default="default",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def save(self, *args, **kwargs):
        self.completed = self.status == self.STATUS_COMPLETED
        super().save(*args, **kwargs)

    def transition_to(self, new_status):
        allowed_transitions = {
            self.STATUS_RUNNING: {self.STATUS_PAUSED, self.STATUS_COMPLETED},
            self.STATUS_PAUSED: set(),
            self.STATUS_COMPLETED: set(),
        }

        if new_status == self.status:
            return

        if new_status not in allowed_transitions[self.status]:
            raise ValueError(
                f"Cannot transition session from '{self.status}' to '{new_status}'."
            )

        self.status = new_status
        self.save(update_fields=["status", "completed"])

    def __str__(self):
        return f"Session {self.id}"


class Preset(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="presets",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=100)
    work_duration = models.IntegerField()
    short_break = models.IntegerField()
    long_break = models.IntegerField()

    class Meta:
        ordering = ["name", "id"]
        unique_together = ["user", "name"]

    def __str__(self):
        return self.name


class OTPVerification(models.Model):
    PURPOSE_RESET = "reset"
    PURPOSE_CHOICES = [
        (PURPOSE_RESET, "Reset Password"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="otp_verifications",
    )
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    code = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.user_id}:{self.purpose}"


class MusicTrack(models.Model):
    name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, blank=True, null=True)
    duration = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name
