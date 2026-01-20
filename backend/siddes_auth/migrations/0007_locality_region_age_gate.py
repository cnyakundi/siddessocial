from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_auth", "0006_account_lifecycle"),
    ]

    operations = [
        migrations.AddField(
            model_name="siddesprofile",
            name="detected_region",
            field=models.CharField(max_length=8, blank=True, default="", db_index=True),
        ),
        migrations.AddField(
            model_name="siddesprofile",
            name="detected_region_source",
            field=models.CharField(max_length=32, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="siddesprofile",
            name="chosen_region",
            field=models.CharField(max_length=8, blank=True, default="", db_index=True),
        ),
        migrations.AddField(
            model_name="siddesprofile",
            name="chosen_region_set_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="siddesprofile",
            name="age_gate_confirmed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="siddesprofile",
            name="age_gate_confirmed_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
