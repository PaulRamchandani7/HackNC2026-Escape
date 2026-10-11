from django.db import models


class LeaderboardEntry(models.Model):
    name = models.CharField(max_length=30)
    seconds = models.FloatField()
    finished_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["seconds", "finished_at"]

    def __str__(self):
        return f"{self.name} ({self.seconds}s)"
