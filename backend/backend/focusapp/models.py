from django.conf import settings
from django.db import models
from django.utils import timezone


class Session(models.Model):
    STATUS_RUNNING = "running"
    STATUS_PAUSED = "paused"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_RUNNING, "Running"),
        (STATUS_PAUSED, "Paused"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
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
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="music_tracks",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, blank=True, null=True)
    audio_file = models.FileField(upload_to="music_tracks/", null=True, blank=True)
    duration = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name


class Playlist(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="playlists",
    )
    name = models.CharField(max_length=255)
    tracks = models.ManyToManyField(
        MusicTrack,
        through="PlaylistTrack",
        related_name="playlists",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        unique_together = ["user", "name"]

    def __str__(self):
        return f"{self.user.username}:{self.name}"


class PlaylistTrack(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)
    track = models.ForeignKey(MusicTrack, on_delete=models.CASCADE)
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ["position"]
        unique_together = ["playlist", "track"]

    def __str__(self):
        return f"{self.playlist.name} - {self.track.name} at {self.position}"


class FavoriteTrack(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_tracks",
    )
    track = models.ForeignKey(
        MusicTrack,
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ["user", "track"]

    def __str__(self):
        return f"{self.user.username} favorited {self.track.name}"


class DailyContribution(models.Model):
    WEIGHT_LOW = "low"
    WEIGHT_NORMAL = "normal"
    WEIGHT_HIGH = "high"
    WEIGHT_CHOICES = [
        (WEIGHT_LOW, "Low"),
        (WEIGHT_NORMAL, "Normal"),
        (WEIGHT_HIGH, "High"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_contributions",
    )
    title = models.CharField(max_length=255)
    notes = models.TextField(blank=True, default="")
    scheduled_date = models.DateField(default=timezone.now)
    weight = models.CharField(
        max_length=10,
        choices=WEIGHT_CHOICES,
        default=WEIGHT_NORMAL,
    )
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_date", "-created_at"]
        indexes = [
            models.Index(fields=["user", "scheduled_date"]),
            models.Index(fields=["user", "completed"]),
        ]

    @property
    def points(self):
        weight_map = {
            self.WEIGHT_LOW: 1,
            self.WEIGHT_NORMAL: 2,
            self.WEIGHT_HIGH: 3,
        }
        return weight_map.get(self.weight, 2)

    def mark_completed(self):
        if not self.completed:
            self.completed = True
            self.completed_at = timezone.now()
            self.save(update_fields=["completed", "completed_at", "updated_at"])

    def mark_uncompleted(self):
        if self.completed:
            self.completed = False
            self.completed_at = None
            self.save(update_fields=["completed", "completed_at", "updated_at"])

    def __str__(self):
        return f"{self.user.username} - {self.title} on {self.scheduled_date}"
