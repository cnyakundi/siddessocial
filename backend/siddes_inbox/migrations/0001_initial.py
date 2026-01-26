# Migration.

from django.db import migrations, models
import django.db.models.deletion


SIDE_CHOICES = [
    ("public", "Public"),
    ("friends", "Friends"),
    ("close", "Close"),
    ("work", "Work"),
]


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="InboxThread",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("locked_side", models.CharField(choices=SIDE_CHOICES, max_length=16)),
                ("title", models.CharField(default="", max_length=255)),
                ("participant_display_name", models.CharField(default="", max_length=255)),
                ("participant_initials", models.CharField(default="", max_length=8)),
                ("participant_avatar_seed", models.CharField(blank=True, max_length=64, null=True)),
                ("participant_user_id", models.CharField(blank=True, max_length=64, null=True)),
                ("participant_handle", models.CharField(blank=True, max_length=64, null=True)),
                ("last_text", models.TextField(default="")),
                ("last_from_id", models.CharField(default="", max_length=64)),
                ("unread_count", models.IntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["locked_side", "updated_at"], name="inbox_thread_side_upd"),
                    models.Index(fields=["updated_at"], name="inbox_thread_updated"),
                ],
            },
        ),
        migrations.CreateModel(
            name="InboxMessage",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("ts", models.DateTimeField()),
                ("from_id", models.CharField(max_length=64)),
                ("text", models.TextField()),
                ("side", models.CharField(choices=SIDE_CHOICES, max_length=16)),
                ("queued", models.BooleanField(default=False)),
                ("client_key", models.CharField(blank=True, max_length=128, null=True)),
                (
                    "thread",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="siddes_inbox.inboxthread",
                    ),
                ),
            ],
            options={
                "ordering": ["ts"],
                "indexes": [
                    models.Index(fields=["thread", "ts"], name="inbox_msg_thread_ts"),
                    models.Index(fields=["ts"], name="inbox_msg_ts"),
                ],
            },
        ),
    ]
