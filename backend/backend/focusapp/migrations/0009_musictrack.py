from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("focusapp", "0008_otpverification"),
    ]

    operations = [
        migrations.CreateModel(
            name="MusicTrack",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("file_path", models.CharField(blank=True, max_length=500, null=True)),
                ("duration", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]
