from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="LeaderboardEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=30)),
                ("seconds", models.FloatField()),
                ("finished_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["seconds", "finished_at"]},
        ),
    ]
