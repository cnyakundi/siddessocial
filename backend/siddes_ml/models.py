from __future__ import annotations

from django.db import models


class MlSuggestionKind(models.TextChoices):
    SIDE_ASSIGNMENT = "side_assignment", "side_assignment"
    SET_CLUSTER = "set_cluster", "set_cluster"
    COMPOSE_INTENT = "compose_intent", "compose_intent"


class MlSuggestionStatus(models.TextChoices):
    NEW = "new", "new"
    ACCEPTED = "accepted", "accepted"
    REJECTED = "rejected", "rejected"
    DISMISSED = "dismissed", "dismissed"


class MlSuggestion(models.Model):
    """A privacy-safe, explainable suggestion for a specific viewer.

    v0 storage rules:
    - viewer_id is the *viewer token* (e.g., me_<django_user_id>), not a FK.
    - payload contains only non-sensitive, derived info (e.g., handles, side, set label).
    """

    id = models.CharField(primary_key=True, max_length=96)

    viewer_id = models.CharField(max_length=64, db_index=True)

    kind = models.CharField(max_length=32, choices=MlSuggestionKind.choices, db_index=True)

    payload = models.JSONField(default=dict)

    # 0..1 confidence
    score = models.FloatField(default=0.0)

    reason_code = models.CharField(max_length=64, default="", blank=True)
    reason_text = models.TextField(default="", blank=True)

    status = models.CharField(
        max_length=16,
        choices=MlSuggestionStatus.choices,
        default=MlSuggestionStatus.NEW,
        db_index=True,
    )

    model_version = models.CharField(max_length=64, default="v0")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["viewer_id", "status", "-created_at"], name="mls_v_st_ca"),
            models.Index(fields=["viewer_id", "kind", "status"], name="mls_v_k_st"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"MlSuggestion({self.id}, viewer={self.viewer_id}, kind={self.kind}, status={self.status})"


class MlFeedbackAction(models.TextChoices):
    ACCEPT = "accept", "accept"
    REJECT = "reject", "reject"
    DISMISS = "dismiss", "dismiss"
    UNDO = "undo", "undo"


class MlFeedback(models.Model):
    """Feedback log for suggestions.

    We keep this tiny so we can train lightweight personalized models later.
    """

    id = models.CharField(primary_key=True, max_length=96)

    suggestion = models.ForeignKey(MlSuggestion, on_delete=models.CASCADE, related_name="feedback")

    viewer_id = models.CharField(max_length=64, db_index=True)

    action = models.CharField(max_length=16, choices=MlFeedbackAction.choices, db_index=True)

    note = models.TextField(default="", blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["viewer_id", "-created_at"], name="mlf_v_ca"),
            models.Index(fields=["action", "-created_at"], name="mlf_act_ca"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"MlFeedback({self.id}, viewer={self.viewer_id}, action={self.action})"
