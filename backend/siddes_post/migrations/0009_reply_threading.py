from __future__ import annotations

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_post", "0008_post_edited_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="reply",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="children",
                to="siddes_post.reply",
            ),
        ),
        migrations.AddField(
            model_name="reply",
            name="depth",
            field=models.PositiveSmallIntegerField(db_index=True, default=0),
        ),
    ]
