# Migration.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_inbox", "0002_inboxthreadreadstate"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="inboxthread",
            name="unread_count",
        ),
    ]
