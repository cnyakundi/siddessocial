from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_safety", "0005_user_mute"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserHiddenPost",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("viewer_id", models.CharField(db_index=True, max_length=64)),
                ("post_id", models.CharField(db_index=True, max_length=128)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "unique_together": {("viewer_id", "post_id")},
            },
        ),
    ]
