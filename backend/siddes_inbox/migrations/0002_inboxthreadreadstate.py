# Migration.

from django.db import migrations, models
import django.db.models.deletion


VIEWER_CHOICES = [
    ("anon", "Anon"),
    ("friends", "Friends"),
    ("close", "Close"),
    ("work", "Work"),
    ("me", "Me"),
]


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_inbox", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="InboxThreadReadState",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("viewer_role", models.CharField(choices=VIEWER_CHOICES, max_length=16)),
                ("last_read_ts", models.DateTimeField(blank=True, null=True)),
                ("unread_count", models.IntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "thread",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="read_states",
                        to="siddes_inbox.inboxthread",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["viewer_role", "thread"], name="inbox_read_role_thread"),
                    models.Index(fields=["thread", "viewer_role"], name="inbox_read_thread_role"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="inboxthreadreadstate",
            constraint=models.UniqueConstraint(fields=("thread", "viewer_role"), name="inbox_read_thread_viewer_uniq"),
        ),
    ]
