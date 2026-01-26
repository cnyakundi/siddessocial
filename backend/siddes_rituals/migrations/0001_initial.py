# Migration.

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Ritual",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("side", models.CharField(choices=[("public", "public"), ("friends", "friends"), ("close", "close"), ("work", "work")], db_index=True, max_length=16)),
                ("set_id", models.CharField(blank=True, db_index=True, max_length=96, null=True)),
                ("kind", models.CharField(db_index=True, max_length=32)),
                ("title", models.CharField(default="", max_length=128)),
                ("prompt", models.TextField(default="")),
                ("status", models.CharField(db_index=True, default="proposed", max_length=16)),
                ("created_by", models.CharField(db_index=True, max_length=64)),
                ("created_at", models.FloatField(db_index=True)),
                ("expires_at", models.FloatField(blank=True, db_index=True, null=True)),
                ("ignite_threshold", models.IntegerField(default=0)),
                ("ignites", models.IntegerField(default=0)),
                ("data", models.JSONField(blank=True, default=dict)),
                ("replies", models.IntegerField(default=0)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["side", "status", "-created_at"], name="siddes_ritu_side_s_5c2a1f_idx"),
                    models.Index(fields=["set_id", "status", "-created_at"], name="siddes_ritu_set_i_2f262f_idx"),
                ]
            },
        ),
    ]
