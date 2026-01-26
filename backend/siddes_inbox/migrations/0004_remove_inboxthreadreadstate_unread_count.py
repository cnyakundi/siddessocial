# Migration.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_inbox", "0003_remove_inboxthread_unread_count"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="inboxthreadreadstate",
            name="unread_count",
        ),
    ]
