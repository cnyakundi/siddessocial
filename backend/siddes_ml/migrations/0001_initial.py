# Migration.
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="MlSuggestion",
            fields=[
                ("id", models.CharField(max_length=96, primary_key=True, serialize=False)),
                ("viewer_id", models.CharField(db_index=True, max_length=64)),
                ("kind", models.CharField(choices=[("side_assignment", "side_assignment"), ("set_cluster", "set_cluster"), ("compose_intent", "compose_intent")], db_index=True, max_length=32)),
                ("payload", models.JSONField(default=dict)),
                ("score", models.FloatField(default=0.0)),
                ("reason_code", models.CharField(blank=True, default="", max_length=64)),
                ("reason_text", models.TextField(blank=True, default="")),
                ("status", models.CharField(choices=[("new", "new"), ("accepted", "accepted"), ("rejected", "rejected"), ("dismissed", "dismissed")], db_index=True, default="new", max_length=16)),
                ("model_version", models.CharField(default="v0", max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["viewer_id", "status", "-created_at"], name="mls_v_st_ca"),
                    models.Index(fields=["viewer_id", "kind", "status"], name="mls_v_k_st"),
                ],
            },
        ),
        migrations.CreateModel(
            name="MlFeedback",
            fields=[
                ("id", models.CharField(max_length=96, primary_key=True, serialize=False)),
                ("viewer_id", models.CharField(db_index=True, max_length=64)),
                ("action", models.CharField(choices=[("accept", "accept"), ("reject", "reject"), ("dismiss", "dismiss"), ("undo", "undo")], db_index=True, max_length=16)),
                ("note", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("suggestion", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="feedback", to="siddes_ml.mlsuggestion")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["viewer_id", "-created_at"], name="mlf_v_ca"),
                    models.Index(fields=["action", "-created_at"], name="mlf_act_ca"),
                ],
            },
        ),
    ]
