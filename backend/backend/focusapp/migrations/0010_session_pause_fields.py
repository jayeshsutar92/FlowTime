from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("focusapp", "0009_musictrack"),
    ]

    operations = [
        migrations.AddField(
            model_name="session",
            name="paused_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="session",
            name="paused_seconds",
            field=models.IntegerField(default=0),
        ),
    ]
