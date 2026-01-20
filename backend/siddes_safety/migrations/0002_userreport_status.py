from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_safety", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userreport",
            name="status",
            field=models.CharField(db_index=True, default="open", max_length=16),
        ),
    ]
