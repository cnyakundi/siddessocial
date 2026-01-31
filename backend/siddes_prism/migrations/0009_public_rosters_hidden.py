from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_prism", "0008_public_follow"),
    ]

    operations = [
        migrations.AddField(
            model_name="prismfacet",
            name="public_rosters_hidden",
            field=models.BooleanField(default=False),
        ),
    ]
