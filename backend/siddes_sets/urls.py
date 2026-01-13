"""URL routing for the Sets API (DRF).

These endpoints mirror the Next.js API stubs so the frontend can switch to the
Django backend via `NEXT_PUBLIC_API_BASE` without rewriting UI.

Routes:
- /api/sets
- /api/sets/<id>
- /api/sets/<id>/events
"""

from __future__ import annotations

from django.urls import path

from .views import SetDetailView, SetEventsView, SetsView

urlpatterns = [
    path("sets", SetsView.as_view(), name="sets"),
    path("sets/<str:set_id>", SetDetailView.as_view(), name="set_detail"),
    path("sets/<str:set_id>/events", SetEventsView.as_view(), name="set_events"),
]
