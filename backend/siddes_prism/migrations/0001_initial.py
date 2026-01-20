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
            name="PrismFacet",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("side", models.CharField(choices=[("public", "Public"), ("friends", "Friends"), ("close", "Close"), ("work", "Work")], db_index=True, max_length=16)),
                ("display_name", models.CharField(default="", max_length=64)),
                ("headline", models.CharField(default="", max_length=96)),
                ("bio", models.TextField(default="")),
                ("location", models.CharField(blank=True, default="", max_length=64)),
                ("website", models.CharField(blank=True, default="", max_length=160)),
                ("anthem_title", models.CharField(blank=True, default="", max_length=96)),
                ("anthem_artist", models.CharField(blank=True, default="", max_length=96)),
                ("pulse_label", models.CharField(blank=True, default="", max_length=48)),
                ("pulse_text", models.CharField(blank=True, default="", max_length=280)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="prism_facets", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "indexes": [models.Index(fields=["user", "side"], name="prismfacet_user_side_idx")],
            },
        ),
        migrations.CreateModel(
            name="SideMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("side", models.CharField(choices=[("public", "Public"), ("friends", "Friends"), ("close", "Close"), ("work", "Work")], db_index=True, max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "member",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="side_incoming", to=settings.AUTH_USER_MODEL),
                ),
                (
                    "owner",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="side_outgoing", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["owner", "side", "updated_at"], name="side_owner_side_upd"),
                    models.Index(fields=["member", "updated_at"], name="side_member_upd"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="prismfacet",
            constraint=models.UniqueConstraint(fields=("user", "side"), name="prismfacet_user_side"),
        ),
        migrations.AddConstraint(
            model_name="sidemembership",
            constraint=models.UniqueConstraint(fields=("owner", "member"), name="side_membership_owner_member"),
        ),
        migrations.AddConstraint(
            model_name="sidemembership",
            constraint=models.CheckConstraint(check=~models.Q(side="public"), name="side_membership_no_public"),
        ),
        migrations.AddConstraint(
            model_name="sidemembership",
            constraint=models.CheckConstraint(check=~models.Q(owner=models.F("member")), name="side_membership_no_self"),
        ),
    ]
