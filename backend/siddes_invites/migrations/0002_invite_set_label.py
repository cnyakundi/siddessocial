from __future__ import annotations

from django.db import migrations, models


def add_set_label_if_missing(apps, schema_editor):
    """Idempotently ensure SiddesInvite.set_label exists.

    This migration is present to support older DBs that may not have had the
    set_label column yet. In the current repo state, 0001_initial already
    defines set_label, so on fresh DBs this should be a no-op.

    We avoid Postgres-only IF NOT EXISTS SQL so sqlite dev/test DBs can migrate
    from zero without failing.
    """

    SiddesInvite = apps.get_model("siddes_invites", "SiddesInvite")
    table = SiddesInvite._meta.db_table

    # Introspect existing columns.
    with schema_editor.connection.cursor() as cursor:
        cols = schema_editor.connection.introspection.get_table_description(cursor, table)
    col_names = {c.name for c in cols}

    if "set_label" in col_names:
        return

    # Add the field in a backend-agnostic way.
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
