from __future__ import annotations

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_prism", "0007_side_access_request"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserFollow",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "follower",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="follow_outgoing",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "target",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="follow_incoming",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["target", "created_at"], name="userfollow_target_created"),
                    models.Index(fields=["follower", "created_at"], name="userfollow_follower_created"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="userfollow",
            constraint=models.UniqueConstraint(fields=("follower", "target"), name="userfollow_follower_target"),
        ),
        migrations.AddConstraint(
            model_name="userfollow",
            constraint=models.CheckConstraint(check=~models.Q(follower=models.F("target")), name="userfollow_no_self"),
        ),
    ]
