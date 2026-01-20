from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_post", "0007_post_is_hidden"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="edited_at",
            field=models.FloatField(blank=True, db_index=True, null=True),
        ),
    ]
