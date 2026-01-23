from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("siddes_prism", "0002_prismfacet_cover_image_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="prismfacet",
            name="avatar_image_url",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
    ]
