from __future__ import annotations

import re
import time
import uuid
from typing import Any, Dict, List, Optional

from django.db import transaction

from .models import MlSuggestion, MlSuggestionKind, MlSuggestionStatus

# Common personal email domains (not exhaustive, but safe for v0 heuristics)
_COMMON_PERSONAL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.uk",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
    "zoho.com",
}

_WORK_MARKERS = ("pm", "dev", "design", "engineer", "qa", "ops", "hr", "ceo", "cto", "cfo")


def _now_ms() -> int:
    return int(time.time() * 1000)


def _new_id(prefix: str) -> str:
    return f"{prefix}_{_now_ms()}_{uuid.uuid4().hex[:8]}"


def _safe_domain(raw: str | None) -> Optional[str]:
    s = str(raw or "").strip().lower()
    if not s or "/" in s or "\\" in s or "@" in s:
        return None
    if len(s) > 128:
        return None
    if not re.fullmatch(r"[a-z0-9.-]+", s):
        return None
    if "." not in s:
        return None
    return s


def _is_workish_domain(domain: str | None) -> bool:
    d = _safe_domain(domain)
    if not d:
        return False
    return d not in _COMMON_PERSONAL_DOMAINS


def _guess_label_from_domain(domain: str) -> str:
    d = _safe_domain(domain) or ""
    if not d:
        return "Colleagues"
    head = d.split(".", 1)[0]
    head = re.sub(r"[^a-z0-9]+", " ", head).strip()
    if not head:
        return d
    # Title-case with a sane cap
    return (head.title()[:24] + " Team").strip()


def seed_from_contact_matches(*, viewer_id: str, match_rows: List[Dict[str, Any]], model_version: str = "contacts_match_v0") -> int:
    """Create set_cluster suggestions from contact-match results.

    match_rows items must be safe/derived:
      {
        "user_id": "me_12",
        "handle": "@someone",
        "domain": "acme.com" | None,
      }

    Returns number of suggestions created.
    """

    v = str(viewer_id or "").strip()
    if not v:
        return 0

    # Normalize & unique
    rows: List[Dict[str, Any]] = []
    seen = set()
    for r in match_rows:
        h = str((r or {}).get("handle") or "").strip()
        if not h:
            continue
        if h.startswith("@"):  # normalize handles
            h = "@" + h[1:].strip().lower()
        if h in seen:
            continue
        seen.add(h)
        rows.append({"handle": h, "domain": _safe_domain((r or {}).get("domain"))})

    if len(rows) < 2:
        # No clusters possible
        return 0

    created = 0

    # Group by work-ish domain
    domain_groups: Dict[str, List[str]] = {}
    for r in rows:
        d = r.get("domain")
        if not _is_workish_domain(d):
            continue
        domain_groups.setdefault(d, []).append(r["handle"])  # type: ignore[index]

    # Work-ish handle markers (fallback when no domains exist)
    workish_handles = [r["handle"] for r in rows if any(m in r["handle"] for m in _WORK_MARKERS)]

    # Starter friends (always safe to suggest; user can skip)
    starter_handles = [r["handle"] for r in rows][: min(6, len(rows))]

    suggestions: List[Dict[str, Any]] = []

    for domain, handles in domain_groups.items():
        handles = list(dict.fromkeys(handles))
        if len(handles) < 2:
            continue
        suggestions.append(
            {
                "kind": MlSuggestionKind.SET_CLUSTER,
                "payload": {
                    "side": "work",
                    "label": _guess_label_from_domain(domain),
                    "color": "slate",
                    "members": handles,
                },
                "score": 0.78,
                "reason_code": "shared_domain",
                "reason_text": f"Shared email domain ({domain})",
            }
        )

    if len(workish_handles) >= 2:
        suggestions.append(
            {
                "kind": MlSuggestionKind.SET_CLUSTER,
                "payload": {
                    "side": "work",
                    "label": "Colleagues",
                    "color": "slate",
                    "members": list(dict.fromkeys(workish_handles))[:24],
                },
                "score": 0.64,
                "reason_code": "work_markers",
                "reason_text": "Work-like handles detected",
            }
        )

    if len(starter_handles) >= 2:
        suggestions.append(
            {
                "kind": MlSuggestionKind.SET_CLUSTER,
                "payload": {
                    "side": "friends",
                    "label": "Starter Crew",
                    "color": "emerald",
                    "members": starter_handles,
                },
                "score": 0.55,
                "reason_code": "starter",
                "reason_text": "Starter Set so you don't start from zero",
            }
        )

    if not suggestions:
        return 0

    with transaction.atomic():
        # Avoid stacking duplicate "new" suggestions on repeated syncs.
        MlSuggestion.objects.filter(viewer_id=v, status=MlSuggestionStatus.NEW, model_version=model_version).delete()

        for s in suggestions[:12]:
            MlSuggestion.objects.create(
                id=_new_id("mls"),
                viewer_id=v,
                kind=str(s["kind"]),
                payload=s.get("payload") or {},
                score=float(s.get("score") or 0.0),
                reason_code=str(s.get("reason_code") or ""),
                reason_text=str(s.get("reason_text") or ""),
                status=MlSuggestionStatus.NEW,
                model_version=model_version,
            )
            created += 1

    return created
