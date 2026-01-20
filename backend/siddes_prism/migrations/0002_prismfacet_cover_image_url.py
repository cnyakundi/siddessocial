from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_prism", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="prismfacet",
            name="cover_image_url",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
    ]
