from __future__ import annotations

from typing import Any, Dict

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SlateEntry


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

        qs = (
            SlateEntry.objects.filter(target_handle=target)
            .order_by("-trust_level", "-created_at")
        )[:50]

        items: list[Dict[str, Any]] = []
        for e in qs:
            items.append(
                {
                    "id": e.id,
                    "targetHandle": e.target_handle,
                    "fromUserId": e.from_user_id,
                    "fromName": e.from_name,
                    "fromHandle": e.from_handle,
                    "kind": e.kind,
                    "text": e.text,
                    "trustLevel": int(e.trust_level or 0),
                    "ts": int(float(e.created_at or 0.0) * 1000),
                }
            )

        return Response(
            {"ok": True, "target": target, "count": len(items), "items": items},
            status=status.HTTP_200_OK,
        )
