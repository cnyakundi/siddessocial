from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_post", "0005_post_echo_of_post_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="public_channel",
            field=models.CharField(blank=True, db_index=True, max_length=32, null=True),
        ),
    ]
