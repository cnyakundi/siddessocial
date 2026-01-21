"""DB models for Posts + Replies (sd_146a).

Important:
- Keep ids as strings (compatible with existing stubs + URLs).
- Keep created_at as float seconds (matches stubs).
- Visibility / viewer gating stays ABOVE the store layer.

Step 2.2: Echo + Quote Echo are DB-backed via Post.echo_of_post_id.

NOTE (sd_435):
- Post.depth was accidentally added to the model without a migration; DB never had the column.
  It caused /api/feed 500s (UndefinedColumn siddes_post_post.depth). Removed.
- Reply.depth exists in DB via migration 0009_reply_threading; add it to the model.
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
    public_channel = models.CharField(max_length=32, null=True, blank=True, db_index=True)
    urgent = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False, db_index=True)
    edited_at = models.FloatField(null=True, blank=True, db_index=True)
    created_at = models.FloatField(db_index=True)
    client_key = models.CharField(max_length=128, null=True, blank=True)
    echo_of_post_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["side", "-created_at"]),
            models.Index(fields=["author_id", "-created_at"]),
            models.Index(fields=["echo_of_post_id", "-created_at"]),
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
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")
    author_id = models.CharField(max_length=64, db_index=True)
    text = models.TextField()
    created_at = models.FloatField(db_index=True)
    depth = models.PositiveSmallIntegerField(default=0, db_index=True)
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


# --- Post Likes (sd_179m) ---
class PostLike(models.Model):
    """Per-viewer likes for posts.

    NOTE: post_id is a string (not FK) so we can like both DB posts and legacy/mock ids.
    """

    post_id = models.CharField(max_length=64, db_index=True)
    viewer_id = models.CharField(max_length=64, db_index=True)
    created_at = models.FloatField(db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["post_id", "-created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["post_id", "viewer_id"], name="uniq_post_like_post_viewer"),
        ]

    def __str__(self) -> str:
        return f"PostLike(post={self.post_id}, viewer={self.viewer_id})"
