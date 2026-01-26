# Migration.

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="MediaObject",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("owner_id", models.CharField(db_index=True, max_length=64)),
                ("r2_key", models.CharField(max_length=512, unique=True)),
                ("kind", models.CharField(choices=[("image", "image"), ("video", "video")], max_length=16)),
                ("content_type", models.CharField(max_length=128)),
                ("bytes", models.BigIntegerField(blank=True, null=True)),
                ("width", models.IntegerField(blank=True, null=True)),
                ("height", models.IntegerField(blank=True, null=True)),
                ("duration_ms", models.IntegerField(blank=True, null=True)),
                ("is_public", models.BooleanField(db_index=True, default=False)),
                ("status", models.CharField(choices=[("pending", "pending"), ("committed", "committed")], db_index=True, default="pending", max_length=16)),
                ("created_at", models.FloatField(db_index=True)),
                ("post_id", models.CharField(blank=True, db_index=True, max_length=64, null=True)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["owner_id", "-created_at"], name="media_owner_time"),
                    models.Index(fields=["is_public", "-created_at"], name="media_public_time"),
                ],
            },
        ),
    ]
