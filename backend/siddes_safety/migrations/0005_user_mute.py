from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_safety", "0004_userappeal"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserMute",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("muter_id", models.CharField(db_index=True, max_length=64)),
                ("muted_token", models.CharField(db_index=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "unique_together": {("muter_id", "muted_token")},
            },
        ),
    ]
