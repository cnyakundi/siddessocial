# Migration.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("siddes_post", "0004_sync_post_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="echo_of_post_id",
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
        migrations.AddIndex(
            model_name="post",
            index=models.Index(fields=["echo_of_post_id", "-created_at"], name="siddes_post_echoof_created_idx"),
        ),
    ]
