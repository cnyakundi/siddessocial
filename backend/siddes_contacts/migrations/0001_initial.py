from __future__ import annotations

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ContactIdentityToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(db_index=True, max_length=64)),
                ("kind", models.CharField(choices=[("email", "email"), ("phone", "phone")], max_length=8)),
                ("value_hint", models.CharField(blank=True, default="", max_length=32)),
                ("verified_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="contact_tokens", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={"unique_together": {("token", "kind")}},
        ),
    ]
