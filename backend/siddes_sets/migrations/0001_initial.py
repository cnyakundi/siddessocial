# Migration.

from __future__ import annotations

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SiddesSet",
            fields=[
                ("id", models.CharField(max_length=96, primary_key=True, serialize=False)),
                ("owner_id", models.CharField(max_length=64)),
                ("side", models.CharField(choices=[("public", "Public"), ("friends", "Friends"), ("close", "Close"), ("work", "Work")], default="friends", max_length=16)),
                ("label", models.CharField(default="", max_length=255)),
                ("color", models.CharField(choices=[("orange", "Orange"), ("purple", "Purple"), ("blue", "Blue"), ("emerald", "Emerald"), ("rose", "Rose"), ("slate", "Slate")], default="emerald", max_length=16)),
                ("members", models.JSONField(default=list)),
                ("count", models.IntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["owner_id", "side", "updated_at"], name="sets_owner_side_upd"),
                    models.Index(fields=["owner_id", "updated_at"], name="sets_owner_upd"),
                ],
            },
        ),
        migrations.CreateModel(
            name="SiddesSetEvent",
            fields=[
                ("id", models.CharField(max_length=96, primary_key=True, serialize=False)),
                ("ts_ms", models.BigIntegerField()),
                ("kind", models.CharField(choices=[("created", "Created"), ("renamed", "Renamed"), ("members_updated", "Members Updated"), ("moved_side", "Moved Side"), ("recolored", "Recolored")], max_length=32)),
                ("by", models.CharField(default="me", max_length=64)),
                ("data", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("set", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="siddes_sets.siddesset")),
            ],
            options={
                "ordering": ["-ts_ms"],
                "indexes": [
                    models.Index(fields=["set", "ts_ms"], name="set_event_set_ts"),
                    models.Index(fields=["ts_ms"], name="set_event_ts"),
                ],
            },
        ),
    ]
