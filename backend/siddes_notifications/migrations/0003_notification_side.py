# Migration.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("siddes_notifications", "0002_sync_model_drift"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="side",
            field=models.CharField(max_length=16, default="public", db_index=True),
        ),
    ]
