from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_safety", "0002_userreport_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="ModerationAuditEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_id", models.CharField(db_index=True, max_length=64)),
                ("action", models.CharField(db_index=True, max_length=32)),
                ("target_type", models.CharField(db_index=True, max_length=16)),
                ("target_id", models.CharField(db_index=True, max_length=128)),
                ("meta", models.JSONField(blank=True, default=dict)),
                ("request_id", models.CharField(blank=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
