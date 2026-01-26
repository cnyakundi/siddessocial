# Migration.
from __future__ import annotations

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Post",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("author_id", models.CharField(db_index=True, max_length=64)),
                ("side", models.CharField(choices=[("public", "public"), ("friends", "friends"), ("close", "close"), ("work", "work")], db_index=True, max_length=16)),
                ("text", models.TextField()),
                ("set_id", models.CharField(blank=True, db_index=True, max_length=64, null=True)),
                ("urgent", models.BooleanField(default=False)),
                ("created_at", models.FloatField(db_index=True)),
                ("client_key", models.CharField(blank=True, max_length=128, null=True)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["side", "-created_at"], name="siddes_post_side_created_at_idx"),
                    models.Index(fields=["author_id", "-created_at"], name="siddes_post_author_created_at_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Reply",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("author_id", models.CharField(db_index=True, max_length=64)),
                ("text", models.TextField()),
                ("created_at", models.FloatField(db_index=True)),
                ("status", models.CharField(default="created", max_length=16)),
                ("client_key", models.CharField(blank=True, max_length=128, null=True)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="replies", to="siddes_post.post", to_field="id")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["post", "-created_at"], name="siddes_reply_post_created_at_idx"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="post",
            constraint=models.UniqueConstraint(fields=("author_id", "client_key"), name="uniq_post_author_client_key"),
        ),
        migrations.AddConstraint(
            model_name="reply",
            constraint=models.UniqueConstraint(fields=("post", "author_id", "client_key"), name="uniq_reply_post_author_client_key"),
        ),
    ]
