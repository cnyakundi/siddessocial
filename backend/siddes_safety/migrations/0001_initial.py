from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="UserBlock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("blocker_id", models.CharField(db_index=True, max_length=64)),
                ("blocked_token", models.CharField(db_index=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "unique_together": {("blocker_id", "blocked_token")},
            },
        ),
        migrations.CreateModel(
            name="UserReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reporter_id", models.CharField(db_index=True, max_length=64)),
                ("target_type", models.CharField(db_index=True, max_length=16)),
                ("target_id", models.CharField(db_index=True, max_length=128)),
                ("reason", models.CharField(db_index=True, max_length=32)),
                ("details", models.TextField(blank=True)),
                ("request_id", models.CharField(blank=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
