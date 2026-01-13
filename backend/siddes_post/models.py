"""DB models for Posts + Replies (sd_146a).

Important:
- Keep ids as strings (compatible with existing stubs + URLs).
- Keep created_at as float seconds (matches stubs).
- Visibility / viewer gating stays ABOVE the store layer.
"""

from __future__ import annotations

from django.db import models


SIDE_CHOICES = (
    ("public", "public"),
    ("friends", "friends"),
    ("close", "close"),
    ("work", "work"),
)


class Post(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    author_id = models.CharField(max_length=64, db_index=True)
    side = models.CharField(max_length=16, choices=SIDE_CHOICES, db_index=True)
    text = models.TextField()
    set_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    urgent = models.BooleanField(default=False)
    created_at = models.FloatField(db_index=True)
    client_key = models.CharField(max_length=128, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["side", "-created_at"]),
            models.Index(fields=["author_id", "-created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["author_id", "client_key"], name="uniq_post_author_client_key"),
        ]

    def __str__(self) -> str:
        return f"Post({self.id}, side={self.side}, author={self.author_id})"


class Reply(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    # NOTE: Django already provides the column/attribute `post_id` for this FK.
    post = models.ForeignKey(Post, to_field="id", on_delete=models.CASCADE, related_name="replies")
    author_id = models.CharField(max_length=64, db_index=True)
    text = models.TextField()
    created_at = models.FloatField(db_index=True)
    status = models.CharField(max_length=16, default="created")
    client_key = models.CharField(max_length=128, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["post", "-created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["post", "author_id", "client_key"], name="uniq_reply_post_author_client_key"),
        ]

    def __str__(self) -> str:
        return f"Reply({self.id}, post={self.post_id}, author={self.author_id})"
