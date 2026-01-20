from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TelemetryEvent


ALLOWED_EVENTS = {
    "suggestion_shown",
    "suggestion_accepted",
    "suggestion_skipped",
    "suggestion_edited",
    "suggestion_undo",
    "embeddings_opt_in",
    "embeddings_opt_out",
}


def _enabled() -> bool:
    return bool(getattr(settings, "SIDDES_TELEMETRY_ENABLED", True))


def _viewer_id(request) -> str | None:
    # Supports:
    # - SiddesViewer(id="me_1") in dev
    # - Django user model in production (int pk)
    u = getattr(request, "user", None)
    if u is not None:
        vid = getattr(u, "id", None)
        if vid is None:
            vid = getattr(u, "pk", None)
        if vid is not None:
            return str(vid)

    v = getattr(request, "viewer", None)
    if v is None:
        return None
    if isinstance(v, str):
        return v
    vid = getattr(v, "id", None)
    if vid is not None:
        return str(vid)
    return None


class TelemetryIngestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _enabled():
            return Response({"ok": False, "error": "telemetry_disabled"}, status=404)

        viewer_id = _viewer_id(request)
        if not viewer_id:
            return Response({"ok": False, "error": "no_viewer"}, status=401)

        data = request.data or {}
        event = str(data.get("event", "")).strip()
        count = data.get("count", 1)

        if event not in ALLOWED_EVENTS:
            return Response({"ok": False, "error": "invalid_event"}, status=400)

        try:
            count = int(count)
        except Exception:
            count = 1

        if count < 1:
            count = 1
        if count > 50:
            count = 50

        rows = [TelemetryEvent(viewer_id=viewer_id, event=event) for _ in range(count)]
        TelemetryEvent.objects.bulk_create(rows)
        return Response({"ok": True})


class TelemetrySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _enabled():
            return Response({"ok": False, "error": "telemetry_disabled"}, status=404)

        viewer_id = _viewer_id(request)
        if not viewer_id:
            return Response({"ok": False, "error": "no_viewer"}, status=401)

        days_raw = request.query_params.get("days", "7")
        try:
            days = int(days_raw)
        except Exception:
            days = 7
        days = max(1, min(days, 30))

        since = timezone.now() - timedelta(days=days)
        qs = TelemetryEvent.objects.filter(viewer_id=viewer_id, created_at__gte=since)

        out = {}
        for e in qs.values_list("event", flat=True):
            out[e] = out.get(e, 0) + 1

        return Response({"ok": True, "days": days, "counts": out})
