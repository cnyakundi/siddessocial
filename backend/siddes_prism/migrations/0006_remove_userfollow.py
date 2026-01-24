from __future__ import annotations

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("siddes_prism", "0005_userfollow"),
    ]

    operations = [
        migrations.DeleteModel(
            name="UserFollow",
        ),
    ]
