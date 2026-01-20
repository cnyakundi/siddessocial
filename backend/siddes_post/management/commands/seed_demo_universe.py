from __future__ import annotations

import time
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from siddes_post.models import Post, Reply
from siddes_sets.models import SiddesSet, SiddesSetMember


class Command(BaseCommand):
    help = "Seed deterministic demo data: sets + posts + replies (Phase A)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete previous seeded records before seeding.")
        parser.add_argument("--viewer", default="me", help="Viewer/owner id to seed for (default: me).")

    @transaction.atomic
    def handle(self, *args: Any, **opts: Any) -> None:
        reset: bool = bool(opts.get("reset"))
        viewer: str = str(opts.get("viewer") or "me").strip()[:64] or "me"

        seed_prefix = f"seed:{viewer}:"
        now = time.time()

        if reset:
            Reply.objects.filter(client_key__startswith=seed_prefix).delete()
            Post.objects.filter(client_key__startswith=seed_prefix).delete()
            SiddesSet.objects.filter(owner_id=viewer, id__startswith=f"seed_{viewer}_").delete()

        # ---- Sets (deterministic IDs) ----
        sets = [
            dict(id=f"seed_{viewer}_friends_gym", owner_id=viewer, side="friends", label="Gym Crew", color="emerald", members=[viewer, "v_friend"], count=0),
            dict(id=f"seed_{viewer}_friends_book", owner_id=viewer, side="friends", label="Book Club", color="emerald", members=[viewer], count=0),
            dict(id=f"seed_{viewer}_close_family", owner_id=viewer, side="close", label="Family", color="rose", members=[viewer], count=0),
            dict(id=f"seed_{viewer}_work_core", owner_id=viewer, side="work", label="Startup Core", color="slate", members=[viewer], count=0),
        ]

        for s in sets:
            obj, _ = SiddesSet.objects.update_or_create(id=s["id"], defaults=s)
            # sd_366: best-effort membership row sync
            try:
                mems = s.get("members") if isinstance(s.get("members"), list) else []
                rows = []
                for m in mems:
                    mid = str(m or "").strip()
                    if not mid:
                        continue
                    if mid.startswith("@"): mid = "@" + mid[1:].strip().lower()
                    rows.append(SiddesSetMember(set=obj, member_id=mid))
                if rows:
                    SiddesSetMember.objects.bulk_create(rows, ignore_conflicts=True)
            except Exception:
                pass

        # ---- Posts (deterministic via (author_id, client_key) uniqueness) ----
        post_specs = [
            ("public", None, False, "Public: Hello world. Siddes is context-first.", "pub_1"),
            ("public", None, False, "Public: A second public note. Topics exist in UI only for now.", "pub_2"),
            ("friends", f"seed_{viewer}_friends_gym", False, "Friends: Gym check-in. Who's training today?", "fr_1"),
            ("friends", f"seed_{viewer}_friends_book", False, "Friends: What are you reading this week?", "fr_2"),
            ("close", f"seed_{viewer}_close_family", False, "Close: Quiet day. Just checking in.", "cl_1"),
            ("work", f"seed_{viewer}_work_core", True, "Work (urgent): Review the launch gates today.", "wk_1"),
        ]

        created_posts: list[Post] = []
        for i, (side, set_id, urgent, text, key) in enumerate(post_specs):
            client_key = f"{seed_prefix}post:{key}"
            defaults = dict(
                id=f"seed_{viewer}_post_{key}",
                author_id=viewer,
                side=side,
                text=text,
                set_id=set_id,
                urgent=urgent,
                created_at=now - (60 * (len(post_specs) - i)),  # stable ordering
                client_key=client_key,
            )
            obj, _ = Post.objects.update_or_create(author_id=viewer, client_key=client_key, defaults=defaults)
            created_posts.append(obj)

        # ---- Replies (seed one reply on the first friends post) ----
        if created_posts:
            target = next((p for p in created_posts if p.side == "friends"), created_posts[0])
            reply_key = f"{seed_prefix}reply:1"
            Reply.objects.update_or_create(
                post=target,
                author_id=viewer,
                client_key=reply_key,
                defaults=dict(
                    id=f"seed_{viewer}_reply_1",
                    post=target,
                    author_id=viewer,
                    text="Reply: seeded response (DB-backed).",
                    created_at=now - 10,
                    status="created",
                    client_key=reply_key,
                ),
            )

        self.stdout.write(self.style.SUCCESS("✅ Seeded demo universe"))
        self.stdout.write(f"Viewer: {viewer}")
        self.stdout.write(f"Sets: {SiddesSet.objects.filter(owner_id=viewer, id__startswith=f'seed_{viewer}_').count()}")
        self.stdout.write(f"Posts: {Post.objects.filter(author_id=viewer, client_key__startswith=seed_prefix).count()}")
        self.stdout.write(f"Replies: {Reply.objects.filter(author_id=viewer, client_key__startswith=seed_prefix).count()}")
