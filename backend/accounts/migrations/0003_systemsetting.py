# Generated manually for SystemSetting

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SystemSetting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(max_length=64, unique=True)),
                ("value", models.TextField(blank=True)),
                ("label", models.CharField(max_length=128)),
                ("help_text", models.TextField(blank=True)),
                ("category", models.CharField(default="general", max_length=32)),
                ("is_secret", models.BooleanField(default=False)),
                ("editable", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["category", "key"],
            },
        ),
    ]
