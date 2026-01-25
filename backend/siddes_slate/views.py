from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Tuple

from django.utils.http import http_date, parse_http_date_safe

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SlateEntry


def _compute_slate_sig(rows: List[Dict[str, Any]]) -> Tuple[str, int]:
    """Return (etag, last_modified_epoch_seconds).

    We intentionally hash the *serialized output fields* for correctness, because
    SlateEntry has no updated_at. If any field changes (text, trustLevel, etc),
    the ETag must change.

    Cost: up to 50 rows, small and safe for a public endpoint.
    """

    if not rows:
        seed = "slate:v1:empty"
        return f'"{hashlib.sha256(seed.encode("utf-8")).hexdigest()}"', 0

    parts: List[str] = []
    last_mod = 0
    for r in rows:
        rid = str(r.get("id") or "")
        trust = int(r.get("trust_level") or 0)
        created = float(r.get("created_at") or 0.0)
        last_mod = max(last_mod, int(created))
        kind = str(r.get("kind") or "")
        from_user = str(r.get("from_user_id") or "")
        from_name = str(r.get("from_name") or "")
        from_handle = str(r.get("from_handle") or "")
        text = str(r.get("text") or "")
        # Keep canonical + stable string form (avoid json float formatting drift).
        parts.append(
            f"{rid}|t={trust}|c={created:.6f}|k={kind}|u={from_user}|h={from_handle}|n={from_name}|x={text}"
        )

    seed = "slate:v1:" + "\n".join(parts)
    etag = f'"{hashlib.sha256(seed.encode("utf-8")).hexdigest()}"'
    return etag, last_mod


def _if_none_match_matches(inm: str, etag: str) -> bool:
    raw = str(inm or "").strip()
    if not raw:
        return False
    # RFC: If-None-Match may be a list or "*".
    for part in raw.split(","):
        p = part.strip()
        if not p:
            continue
        if p == "*":
            return True
        if p == etag:
            return True
    return False


class PublicSlateListView(APIView):
    """GET /api/slate?target=@handle

    Public read.
    Later we'll enforce trust, rate limits, moderation.
    """

    throttle_scope = "slate_public"
    permission_classes: list = []

    def get(self, request):
        target = (request.query_params.get("target") or request.query_params.get("handle") or "").strip()
        if not target:
            return Response(
                {"ok": False, "error": "missing_target"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch only the fields we return (plus created_at for ts).
        rows = list(
            SlateEntry.objects.filter(target_handle=target)
            .order_by("-trust_level", "-created_at")
            .values(
                "id",
                "target_handle",
                "from_user_id",
                "from_name",
                "from_handle",
                "kind",
                "text",
                "trust_level",
                "created_at",
            )[:50]
        )

        etag, last_mod = _compute_slate_sig(rows)

        inm = request.headers.get("If-None-Match") or ""
        ims = request.headers.get("If-Modified-Since") or ""

        # Conditional requests: prefer ETag matching.
        if _if_none_match_matches(inm, etag):
            resp = Response(status=status.HTTP_304_NOT_MODIFIED)
            resp["ETag"] = etag
            resp["Last-Modified"] = http_date(last_mod)
            resp["Cache-Control"] = "public, max-age=0, must-revalidate"
            return resp

        if ims:
            ims_ts = parse_http_date_safe(str(ims))
            if ims_ts is not None and int(ims_ts) >= int(last_mod):
                resp = Response(status=status.HTTP_304_NOT_MODIFIED)
                resp["ETag"] = etag
                resp["Last-Modified"] = http_date(last_mod)
                resp["Cache-Control"] = "public, max-age=0, must-revalidate"
                return resp

        items: list[Dict[str, Any]] = []
        for r in rows:
            items.append(
                {
                    "id": r.get("id"),
                    "targetHandle": r.get("target_handle"),
                    "fromUserId": r.get("from_user_id") or "",
                    "fromName": r.get("from_name") or "",
                    "fromHandle": r.get("from_handle") or "",
                    "kind": r.get("kind") or "",
                    "text": r.get("text") or "",
                    "trustLevel": int(r.get("trust_level") or 0),
                    "ts": int(float(r.get("created_at") or 0.0) * 1000),
                }
            )

        resp = Response(
            {"ok": True, "target": target, "count": len(items), "items": items},
            status=status.HTTP_200_OK,
        )
        resp["ETag"] = etag
        resp["Last-Modified"] = http_date(last_mod)
        resp["Cache-Control"] = "public, max-age=0, must-revalidate"
        return resp
