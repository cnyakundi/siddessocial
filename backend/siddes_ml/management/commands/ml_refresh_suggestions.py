from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from siddes_backend.identity import normalize_handle

from siddes_ml.models import MlSuggestion
from siddes_ml.seed import seed_from_contact_matches


_WORK_MARKERS = ("pm", "dev", "design", "engineer", "qa", "ops", "hr")


def _auto_viewer_id() -> str:
    try:
        User = get_user_model()
        u = User.objects.order_by("id").first()
        if u is not None and getattr(u, "id", None) is not None:
            return f"me_{u.id}"
    except Exception:
        pass
    return "me"


class Command(BaseCommand):
    help = "Refresh ML suggestions (Phase 0 heuristics) for a viewer."

    def add_arguments(self, parser):
        parser.add_argument("--viewer", default="auto", help="Viewer id (default: auto -> me_<first_user_id>)")
        parser.add_argument("--reset", action="store_true", help="Delete existing NEW suggestions for this viewer first")

    def handle(self, *args: Any, **opts: Any) -> None:
        viewer_raw = str(opts.get("viewer") or "auto").strip()
        viewer = _auto_viewer_id() if viewer_raw in ("", "auto") else viewer_raw
        viewer = viewer or "me"

        reset = bool(opts.get("reset"))

        # Build a synthetic match list from existing users (dev helper)
        User = get_user_model()
        uid = None
        if viewer.startswith("me_"):
            try:
                uid = int(viewer.split("me_", 1)[1])
            except Exception:
                uid = None

        qs = User.objects.all().order_by("id")
        if uid is not None:
            qs = qs.exclude(id=uid)
        users = list(qs[:80])

        rows: List[Dict[str, Any]] = []
        for u in users:
            uname = str(getattr(u, "username", "") or "").strip()
            if not uname:
                continue
            h = normalize_handle("@" + uname) or ("@" + uname.lower())
            rows.append({"user_id": f"me_{getattr(u,'id','')}", "handle": h, "domain": None})

        if reset:
            MlSuggestion.objects.filter(viewer_id=viewer, status="new", model_version="manual_refresh_v0").delete()

        created = seed_from_contact_matches(viewer_id=viewer, match_rows=rows, model_version="manual_refresh_v0")

        self.stdout.write(self.style.SUCCESS("✅ Refreshed ML suggestions"))
        self.stdout.write(f"Viewer: {viewer}")
        self.stdout.write(f"Created: {created}")
