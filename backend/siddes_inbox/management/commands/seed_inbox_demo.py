"""Seed deterministic demo inbox content into the DB.

Purpose (sd_121c + sd_121e):
- Make `SD_INBOX_STORE=db` immediately demoable.
- Keep seed data deterministic (stable ids) so debugging is predictable.

Usage:
  python manage.py seed_inbox_demo --reset

Notes:
- This is dev-only demo content. It is NOT a migration of real user data.
- Thread/message ids are stable strings (match the API contract).
- Unread is seeded per-viewer via `InboxThreadReadState`.
"""

from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from ...models import InboxMessage, InboxThread, InboxThreadReadState


class Command(BaseCommand):
    help = "Seed deterministic demo inbox threads/messages into the DB"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing inbox threads/messages before seeding.",
        )

    def handle(self, *args, **options):
        reset = bool(options.get("reset"))
        now = timezone.now()

        if reset:
            self.stdout.write("• Resetting existing inbox tables...")
            InboxThreadReadState.objects.all().delete()
            InboxMessage.objects.all().delete()
            InboxThread.objects.all().delete()

        def add_thread(
            *,
            tid: str,
            title: str,
            initials: str,
            locked_side: str,
            avatar_seed: str,
            unread: int,
            messages: list[tuple[int, str, str]],
        ) -> None:
            with transaction.atomic():
                t = InboxThread.objects.create(
                    id=tid,
                    locked_side=locked_side,
                    title=title,
                    participant_display_name=title,
                    participant_initials=initials,
                    participant_avatar_seed=avatar_seed,
                    last_text="",
                    last_from_id="",
                )

                created: list[InboxMessage] = []
                for idx, (mins_ago, frm, txt) in enumerate(messages, start=1):
                    ts = now - timedelta(minutes=int(mins_ago))
                    mid = f"m_{tid}_{idx:02d}"
                    created.append(
                        InboxMessage.objects.create(
                            id=mid,
                            thread=t,
                            ts=ts,
                            from_id=frm,
                            text=txt,
                            side=locked_side,
                            queued=False,
                            client_key=None,
                        )
                    )

                # Update thread caches to match latest message timestamps.
                if created:
                    latest = max(created, key=lambda m: (m.ts, m.id))
                    InboxThread.objects.filter(id=tid).update(
                        last_text=latest.text,
                        last_from_id=latest.from_id,
                        updated_at=latest.ts,
                    )
                else:
                    InboxThread.objects.filter(id=tid).update(updated_at=now)

                # Seed per-viewer unread state for the owning viewer ("me").
                #
                # sd_121j: unread is derived from last_read_ts + incoming messages.
                # We choose a last_read_ts boundary such that:
                #   derived_unread == requested `unread` (counting only from_id="them").
                boundary_ts = None
                if created:
                    created_sorted = sorted(created, key=lambda m: (m.ts, m.id))
                    them_msgs = [m for m in created_sorted if str(getattr(m, "from_id", "")) == "them"]
                    n_them = len(them_msgs)
                    u = max(0, int(unread))

                    if n_them <= 0:
                        boundary_ts = now
                    elif u <= 0:
                        boundary_ts = them_msgs[-1].ts
                    elif u >= n_them:
                        boundary_ts = None  # => epoch in derived mode (all incoming unread)
                    else:
                        idx = n_them - u - 1
                        boundary_ts = them_msgs[idx].ts

                InboxThreadReadState.objects.update_or_create(
                    thread=t,
                    viewer_role="me",
                    defaults={
                        "last_read_ts": boundary_ts,
                    },
                )

        # Matches the in-memory seed (store_memory.seed_demo).
        add_thread(
            tid="t_friends_1",
            title="Marcus",
            initials="M",
            locked_side="friends",
            avatar_seed="seed_marcus",
            unread=1,
            messages=[
                (120, "them", "Yo — you free this weekend?"),
                (5, "them", "Count me in for Saturday!"),
            ],
        )

        add_thread(
            tid="t_work_1",
            title="Work Group",
            initials="WG",
            locked_side="work",
            avatar_seed="seed_work_group",
            unread=0,
            messages=[
                (180, "them", "Updated the roadmap slides."),
                (12, "them", "Please review before standup."),
            ],
        )

        add_thread(
            tid="t_close_1",
            title="Elena",
            initials="E",
            locked_side="close",
            avatar_seed="seed_elena",
            unread=2,
            messages=[
                (90, "them", "Coffee later?"),
                (35, "them", "Also—did you see that update?"),
                (8, "them", "Ping me when you're free."),
            ],
        )

        add_thread(
            tid="t_public_1",
            title="Tipline",
            initials="T",
            locked_side="public",
            avatar_seed="seed_tipline",
            unread=0,
            messages=[
                (240, "them", "Thanks for reaching out."),
                (60, "them", "We received your message."),
            ],
        )

        threads = InboxThread.objects.count()
        msgs = InboxMessage.objects.count()
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"✅ Seed complete: {threads} threads, {msgs} messages"))
