from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_post", "0006_post_public_channel"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="is_hidden",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
