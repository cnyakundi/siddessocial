from __future__ import annotations

import re
import time
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from siddes_slate.models import SlateEntry


def _safe(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_\-@]", "_", s)[:64] or "@me"


def _auto_target() -> str:
    try:
        User = get_user_model()
        u = User.objects.order_by("id").first()
        if u is not None:
            username = str(getattr(u, "username", "") or "").strip()
            if username:
                return f"@{username}"
    except Exception:
        pass
    return "@founder"


class Command(BaseCommand):
    help = "Seed deterministic Public Slate entries into the DB (removes frontend demo slate mocks)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete previous seeded slate entries first.")
        parser.add_argument(
            "--target",
            default="auto",
            help="Target handle to seed for (default: auto -> @<first_user_username> or @founder).",
        )

    @transaction.atomic
    def handle(self, *args: Any, **opts: Any) -> None:
        reset = bool(opts.get("reset"))
        target_raw = str(opts.get("target") or "auto").strip()
        target = _auto_target() if target_raw in ("", "auto") else target_raw
        target = _safe(target)

        seed_prefix = f"seed_slate_{_safe(target)}_"
        now = time.time()

        if reset:
            SlateEntry.objects.filter(id__startswith=seed_prefix).delete()

        # Seed a small, human-feeling stack.
        specs = [
            ("vouch", "marcus", "Marcus", "@marc_us", 2, "Elena’s design reviews are the reason our app doesn’t feel like a spreadsheet."),
            ("question", "sarah", "Sarah J.", "@sara_j", 1, "Any recs for building a token system that doesn’t turn into a monster?"),
            ("vouch", "me", "Founder", "@founder", 3, "If you want calm UI at scale, side this person. They’re allergic to clutter (in a good way)."),
        ]

        for i, (kind, from_uid, from_name, from_handle, trust, text) in enumerate(specs, start=1):
            SlateEntry.objects.update_or_create(
                id=f"{seed_prefix}e{i}",
                defaults=dict(
                    target_handle=target,
                    from_user_id=str(from_uid)[:64],
                    from_name=str(from_name)[:255],
                    from_handle=str(from_handle)[:64],
                    kind=kind,
                    text=text,
                    trust_level=int(trust),
                    created_at=now - (60 * i),
                ),
            )

        self.stdout.write(self.style.SUCCESS("✅ Seeded Public Slate demo"))
        self.stdout.write(f"Target: {target}")
        self.stdout.write(f"Count: {SlateEntry.objects.filter(target_handle=target).count()}")
