"""URL routing for the Sets API (DRF).

These endpoints mirror the Next.js API stubs so the frontend can switch to the
Django backend via `NEXT_PUBLIC_API_BASE` without rewriting UI.

Routes:
- /api/circles
- /api/circles/<id>
- /api/circles/<id>/events
- /api/circles/<id>/leave
"""

from __future__ import annotations

from django.urls import path

from .views import SetDetailView, SetEventsView, SetLeaveView, SetsView

urlpatterns = [
    path("circles", SetsView.as_view(), name="sets"),
    path("circles/<str:set_id>", SetDetailView.as_view(), name="set_detail"),
    path("circles/<str:set_id>/events", SetEventsView.as_view(), name="set_events"),
    path("circles/<str:set_id>/leave", SetLeaveView.as_view(), name="set_leave"),
]
