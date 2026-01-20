from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.db import transaction
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_backend.csrf import dev_csrf_exempt
from siddes_backend.identity import viewer_aliases
from siddes_inbox.visibility_stub import resolve_viewer_role
from siddes_sets.store_db import DbSetsStore

from .models import MlFeedback, MlFeedbackAction, MlSuggestion, MlSuggestionKind, MlSuggestionStatus


def _raw_viewer_from_request(request) -> Optional[str]:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        uid = str(getattr(user, "id", "") or "").strip()
        return f"me_{uid}" if uid else None

    if not getattr(settings, "DEBUG", False):
        return None

    raw = request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")
    raw = str(raw or "").strip()
    return raw or None


def _viewer_ctx(request) -> Tuple[bool, str, str]:
    raw = _raw_viewer_from_request(request)
    has_viewer = bool(raw)
    viewer = (raw or "anon").strip() or "anon"
    role = resolve_viewer_role(viewer) or "anon"
    return has_viewer, viewer, role


def _suggestion_to_item(s: MlSuggestion) -> Dict[str, Any]:
    payload = s.payload if isinstance(s.payload, dict) else {}
    return {
        "id": s.id,
        "viewer": str(s.viewer_id),
        "kind": str(s.kind),
        "payload": payload,
        "score": float(s.score or 0.0),
        "reasonCode": str(s.reason_code or ""),
        "reasonText": str(s.reason_text or ""),
        "status": str(s.status),
        "modelVersion": str(s.model_version or ""),
        "createdAt": int(s.created_at.timestamp() * 1000) if getattr(s, "created_at", None) else int(time.time() * 1000),
        "updatedAt": int(s.updated_at.timestamp() * 1000) if getattr(s, "updated_at", None) else int(time.time() * 1000),
    }


@method_decorator(dev_csrf_exempt, name="dispatch")
class MlSuggestionsView(APIView):
    """GET /api/ml/suggestions

    Query params:
      - kind: optional filter
      - status: default 'new'
    """

    permission_classes: list = []

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(
                {"ok": True, "restricted": True, "viewer": None, "role": role, "items": []},
                status=status.HTTP_200_OK,
            )

        kind = str(request.query_params.get("kind") or "").strip()
        status_q = str(request.query_params.get("status") or "new").strip().lower() or "new"

        aliases = list(viewer_aliases(viewer)) or [viewer]

        qs = MlSuggestion.objects.filter(viewer_id__in=aliases)
        if kind:
            qs = qs.filter(kind=kind)
        if status_q:
            qs = qs.filter(status=status_q)

        qs = qs.order_by("-created_at")[:200]
        items = [_suggestion_to_item(s) for s in qs]

        return Response(
            {"ok": True, "restricted": False, "viewer": viewer, "role": role, "count": len(items), "items": items},
            status=status.HTTP_200_OK,
        )


@method_decorator(dev_csrf_exempt, name="dispatch")
class MlSuggestionActionView(APIView):
    """POST /api/ml/suggestions/<id>/<action>

    actions: accept | reject | dismiss

    For kind=set_cluster, accept will create a real Set via DbSetsStore.
    """

    permission_classes: list = []

    def post(self, request, suggestion_id: str, action: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        sid = str(suggestion_id or "").strip()
        act = str(action or "").strip().lower()
        if act not in ("accept", "reject", "dismiss"):
            return Response({"ok": False, "error": "bad_action"}, status=status.HTTP_400_BAD_REQUEST)

        aliases = list(viewer_aliases(viewer)) or [viewer]

        with transaction.atomic():
            try:
                s = MlSuggestion.objects.select_for_update().get(id=sid, viewer_id__in=aliases)
            except MlSuggestion.DoesNotExist:
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

            # Idempotency-ish
            if str(s.status) in (MlSuggestionStatus.ACCEPTED, MlSuggestionStatus.REJECTED, MlSuggestionStatus.DISMISSED):
                return Response({"ok": True, "item": _suggestion_to_item(s)}, status=status.HTTP_200_OK)

            if act == "accept":
                # For set_cluster, create a real Set for this viewer.
                if str(s.kind) == MlSuggestionKind.SET_CLUSTER:
                    payload = s.payload if isinstance(s.payload, dict) else {}
                    side = str(payload.get("side") or "friends")
                    label = str(payload.get("label") or "Untitled")
                    members = payload.get("members") if isinstance(payload.get("members"), list) else []
                    color = str(payload.get("color") or "") or None
                    try:
                        created = DbSetsStore().create(owner_id=viewer, side=side, label=label, members=[str(m) for m in members], color=color)
                        # Attach created set id for UI/debug
                        payload["createdSetId"] = str(created.get("id") or "")
                        s.payload = payload
                    except Exception:
                        # Fail-closed on side effects: do not accept if set creation failed.
                        return Response({"ok": False, "error": "set_create_failed"}, status=status.HTTP_409_CONFLICT)

                s.status = MlSuggestionStatus.ACCEPTED
                s.save(update_fields=["status", "payload", "updated_at"])

                MlFeedback.objects.create(
                    id=f"mlf_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}",
                    suggestion=s,
                    viewer_id=viewer,
                    action=MlFeedbackAction.ACCEPT,
                    note="",
                )

                return Response({"ok": True, "item": _suggestion_to_item(s)}, status=status.HTTP_200_OK)

            if act == "reject":
                s.status = MlSuggestionStatus.REJECTED
                s.save(update_fields=["status", "updated_at"])

                MlFeedback.objects.create(
                    id=f"mlf_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}",
                    suggestion=s,
                    viewer_id=viewer,
                    action=MlFeedbackAction.REJECT,
                    note="",
                )

                return Response({"ok": True, "item": _suggestion_to_item(s)}, status=status.HTTP_200_OK)

            # dismiss
            s.status = MlSuggestionStatus.DISMISSED
            s.save(update_fields=["status", "updated_at"])

            MlFeedback.objects.create(
                id=f"mlf_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}",
                suggestion=s,
                viewer_id=viewer,
                action=MlFeedbackAction.DISMISS,
                note="",
            )

            return Response({"ok": True, "item": _suggestion_to_item(s)}, status=status.HTTP_200_OK)
