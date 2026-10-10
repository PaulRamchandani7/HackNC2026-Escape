from django.db import models


class Player(models.Model):
    id = models.CharField(primary_key=True, max_length=36)
    nickname = models.CharField(max_length=32)
    created_at = models.BigIntegerField()


class Mission(models.Model):
    id = models.CharField(primary_key=True, max_length=36)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="missions")
    mission_key = models.CharField(max_length=64)
    started_at = models.BigIntegerField()
    completed_at = models.BigIntegerField(null=True, blank=True)
    escape_ms = models.BigIntegerField(null=True, blank=True)
    hints_used = models.IntegerField(default=0)
    status = models.CharField(max_length=16)


class MissionRoom(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name="rooms")
    room = models.IntegerField()
    slug = models.CharField(max_length=80)
    question_id = models.CharField(max_length=16)
    title = models.CharField(max_length=200)
    difficulty = models.CharField(max_length=16)
    category = models.CharField(max_length=64)
    leetcode_url = models.CharField(max_length=300)
    metadata_source = models.CharField(max_length=16)
    repeated = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["mission", "room"], name="unique_mission_room"),
        ]


class Unlock(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name="unlocks")
    slug = models.CharField(max_length=80)
    accepted_at = models.BigIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["mission", "slug"], name="unique_mission_unlock"),
        ]


class Submission(models.Model):
    id = models.CharField(primary_key=True, max_length=36)
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name="submissions")
    slug = models.CharField(max_length=80)
    passed = models.BooleanField()
    kind = models.CharField(max_length=16)
    created_at = models.BigIntegerField()


class HintReveal(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name="hint_reveals")
    slug = models.CharField(max_length=80)
    hint_index = models.IntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["mission", "slug", "hint_index"], name="unique_hint_reveal"),
        ]


class CompletedProblem(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="completed_problems")
    slug = models.CharField(max_length=80)
    completed_at = models.BigIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["player", "slug"], name="unique_completed_problem"),
        ]
