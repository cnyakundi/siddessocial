# Migration.
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SlateEntry",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("target_handle", models.CharField(db_index=True, max_length=64)),
                ("from_user_id", models.CharField(default="", max_length=64)),
                ("from_name", models.CharField(default="", max_length=255)),
                ("from_handle", models.CharField(default="", max_length=64)),
                ("kind", models.CharField(choices=[("vouch", "vouch"), ("question", "question")], db_index=True, max_length=16)),
                ("text", models.TextField(default="")),
                ("trust_level", models.IntegerField(db_index=True, default=1)),
                ("created_at", models.FloatField(db_index=True)),
            ],
            options={
                "indexes": [models.Index(fields=["target_handle", "-trust_level", "-created_at"], name="slate_target_tr_created")],
            },
        ),
    ]
