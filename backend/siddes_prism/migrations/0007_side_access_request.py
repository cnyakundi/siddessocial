from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_prism", "0006_remove_userfollow"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SideAccessRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("side", models.CharField(choices=[("public", "Public"), ("friends", "Friends"), ("close", "Close"), ("work", "Work")], db_index=True, max_length=16)),
                ("status", models.CharField(choices=[("pending", "pending"), ("accepted", "accepted"), ("rejected", "rejected"), ("cancelled", "cancelled")], db_index=True, default="pending", max_length=16)),
                ("message", models.CharField(blank=True, default="", max_length=280)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="side_access_requests_in", to=settings.AUTH_USER_MODEL)),
                ("requester", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="side_access_requests_out", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["owner", "status", "-updated_at"], name="side_access_owner_st_upd"),
                    models.Index(fields=["requester", "status", "-updated_at"], name="side_access_req_st_upd"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="sideaccessrequest",
            constraint=models.UniqueConstraint(fields=("owner", "requester", "side"), name="side_access_req_uniq"),
        ),
        migrations.AddConstraint(
            model_name="sideaccessrequest",
            constraint=models.CheckConstraint(check=~models.Q(("side", "public")), name="side_access_req_no_public"),
        ),
        migrations.AddConstraint(
            model_name="sideaccessrequest",
            constraint=models.CheckConstraint(check=~models.Q(("owner", models.F("requester"))), name="side_access_req_no_self"),
        ),
    ]
