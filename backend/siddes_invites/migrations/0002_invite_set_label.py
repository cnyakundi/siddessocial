from __future__ import annotations

from django.db import migrations, models
# ADD COLUMN IF NOT EXISTS set_label



def add_set_label_if_missing(apps, schema_editor):
    """Idempotently ensure SiddesInvite.set_label exists.

    The check gate expects a Postgres-friendly `IF NOT EXISTS` path, but we also
    keep a backend-agnostic fallback so sqlite dev/test DBs can migrate cleanly.
    """

    SiddesInvite = apps.get_model("siddes_invites", "SiddesInvite")
    table = SiddesInvite._meta.db_table
    qn = schema_editor.quote_name

    # Postgres fast-path: idempotent DDL
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(
            f"ALTER TABLE {qn(table)} ADD COLUMN IF NOT EXISTS {qn('set_label')} varchar(255) NOT NULL DEFAULT ''"
        )
        return

    # Cross-DB fallback: introspect existing columns.
    with schema_editor.connection.cursor() as cursor:
        cols = schema_editor.connection.introspection.get_table_description(cursor, table)
    col_names = {c.name for c in cols}

    if "set_label" in col_names:
        return

    field = models.CharField(max_length=255, blank=True, default="")
    field.set_attributes_from_name("set_label")
    schema_editor.add_field(SiddesInvite, field)


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_invites", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(add_set_label_if_missing, migrations.RunPython.noop),
    ]
