from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_safety", "0003_moderation_audit_event"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserAppeal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("appellant_id", models.CharField(db_index=True, max_length=64)),
                ("target_type", models.CharField(db_index=True, default="account", max_length=16)),
                ("target_id", models.CharField(blank=True, db_index=True, default="", max_length=128)),
                ("reason", models.CharField(db_index=True, default="other", max_length=32)),
                ("details", models.TextField(blank=True)),
                ("request_id", models.CharField(blank=True, max_length=64)),
                ("status", models.CharField(db_index=True, default="open", max_length=16)),
                ("staff_note", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
