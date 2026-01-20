from __future__ import annotations

import re
import time
from typing import Any, Optional

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from siddes_post.models import Post
from siddes_notifications.models import Notification


def _auto_viewer_id() -> str:
    try:
        User = get_user_model()
        u = User.objects.order_by("id").first()
        if u is not None and getattr(u, "id", None) is not None:
            return f"me_{u.id}"
    except Exception:
        pass
    return "me"


def _safe(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_\\-]", "_", s)[:64] or "me"


class Command(BaseCommand):
    help = "Seed deterministic demo notifications into the DB (so UI has no mocks)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete previous seeded notifications first.")
        parser.add_argument(
            "--viewer",
            default="auto",
            help="Viewer id to seed for (default: auto -> me_<first_user_id> if exists).",
        )

    @transaction.atomic
    def handle(self, *args: Any, **opts: Any) -> None:
        reset = bool(opts.get("reset"))
        viewer_raw = str(opts.get("viewer") or "auto").strip()
        viewer = _auto_viewer_id() if viewer_raw in ("", "auto") else viewer_raw[:64]
        viewer = viewer or "me"

        safe_viewer = _safe(viewer)
        seed_prefix = f"seed_{safe_viewer}_"
        now = time.time()

        if reset:
            Notification.objects.filter(id__startswith=seed_prefix).delete()

        posts = list(Post.objects.order_by("-created_at")[:20])

        def pick(side: str) -> Optional[Post]:
            for p in posts:
                if str(p.side) == side:
                    return p
            return posts[0] if posts else None

        p_friends = pick("friends")
        p_public = pick("public")
        p_work = pick("work")

        specs = [
            ("reply", "Marcus", p_friends, "Count me in for Saturday!"),
            ("like", "Elena", p_public, "Liked your post."),
            ("mention", "Work Group", p_work, "@you mentioned you in Roadmap"),
            ("like", "Marcus", p_public, "Liked your update."),
        ]

        for i, (typ, actor, post, glimpse) in enumerate(specs, start=1):
            pid = getattr(post, "id", None) if post else None
            title = (str(getattr(post, "text", ""))[:48] if post else None) or None
            Notification.objects.update_or_create(
                id=f"{seed_prefix}n{i}",
                defaults=dict(
                    viewer_id=viewer,
                    type=typ,
                    actor=actor,
                    glimpse=glimpse,
                    post_id=pid,
                    post_title=title,
                    created_at=now - (60 * i),
                    read_at=None,
                ),
            )

        self.stdout.write(self.style.SUCCESS("✅ Seeded notifications demo"))
        self.stdout.write(f"Viewer: {viewer}")
        self.stdout.write(f"Count: {Notification.objects.filter(viewer_id=viewer).count()}")
