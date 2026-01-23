from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("siddes_prism", "0003_prismfacet_avatar_image_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="prismfacet",
            name="avatar_media_key",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
    ]
