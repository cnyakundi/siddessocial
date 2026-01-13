"""URL routing for the Invites API (DRF).

Routes:
- /api/invites
- /api/invites/<id>
"""

from __future__ import annotations

from django.urls import path

from .views import InviteDetailView, InvitesView

urlpatterns = [
    path("invites", InvitesView.as_view(), name="invites"),
    path("invites/<str:invite_id>", InviteDetailView.as_view(), name="invite_detail"),
]
