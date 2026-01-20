from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_auth", "0003_password_reset"),
    ]

    operations = [
        migrations.AddField(
            model_name="siddesprofile",
            name="account_state",
            field=models.CharField(max_length=16, default="active", db_index=True),
        ),
        migrations.AddField(
            model_name="siddesprofile",
            name="account_state_until",
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="siddesprofile",
            name="account_state_reason",
            field=models.CharField(max_length=160, blank=True),
        ),
        migrations.AddField(
            model_name="siddesprofile",
            name="account_state_set_by",
            field=models.CharField(max_length=64, blank=True),
        ),
        migrations.AddField(
            model_name="siddesprofile",
            name="account_state_set_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
