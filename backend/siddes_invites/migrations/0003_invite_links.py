from __future__ import annotations

from django.db import migrations, models

def create_invite_links_table(apps, schema_editor):
    """Idempotently create the invite-links table.

    Avoids DuplicateTable errors if a dev DB already has the table.
    """
    try:
        InviteLink = apps.get_model("siddes_invites", "SiddesInviteLink")
    except LookupError:
        # SeparateDatabaseAndState passes a pre-state app registry here.
        # Fall back to importing the real model class (dev-safe).
        from siddes_invites.models import SiddesInviteLink as InviteLink  # type: ignore

    table = InviteLink._meta.db_table

    with schema_editor.connection.cursor() as cursor:
        tables = set(schema_editor.connection.introspection.table_names(cursor))

    if table in tables:
        return

    schema_editor.create_model(InviteLink)

class Migration(migrations.Migration):
    dependencies = [
        ("siddes_invites", "0002_invite_set_label"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="SiddesInviteLink",
                    fields=[
                        ("token", models.CharField(primary_key=True, serialize=False, max_length=64)),
                        ("owner_id", models.CharField(max_length=64)),
                        ("set_id", models.CharField(max_length=96)),
                        ("set_label", models.CharField(blank=True, default="", max_length=255)),
                        ("side", models.CharField(default="friends", max_length=16)),
                        ("max_uses", models.IntegerField(default=10)),
                        ("uses", models.IntegerField(default=0)),
                        ("expires_at", models.DateTimeField(blank=True, null=True)),
                        ("revoked_at", models.DateTimeField(blank=True, null=True)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        "indexes": [
                            models.Index(fields=["owner_id", "set_id", "updated_at"], name="invlink_owner_set_upd"),
                            models.Index(fields=["set_id", "updated_at"], name="invlink_set_upd"),
                        ],
                    },
                ),
            ],
            database_operations=[
                migrations.RunPython(create_invite_links_table, migrations.RunPython.noop),
            ],
        ),
    ]
