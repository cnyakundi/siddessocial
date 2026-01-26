# Migration.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("siddes_inbox", "0006_readstate_viewer_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="inboxthread",
            name="owner_viewer_id",
            field=models.CharField(default="", max_length=64),
        ),
        migrations.AddIndex(
            model_name="inboxthread",
            index=models.Index(fields=["owner_viewer_id", "updated_at"], name="inbox_thread_owner_upd"),
        ),
    ]
