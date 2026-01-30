"""URL routing for the Invites API (DRF).

Routes:
- /api/invites
- /api/invites/<id>
"""

from __future__ import annotations

from django.urls import path

from .views import InviteDetailView, InvitesView, CircleInviteLinksView, CircleInviteLinkRevokeView, InviteLinkPublicView, InviteLinkAcceptView

urlpatterns = [
    path("invites", InvitesView.as_view(), name="invites"),
    path("invites/<str:invite_id>", InviteDetailView.as_view(), name="invite_detail"),

# sd_708: shareable invite links for Sets (/i/<token>)
path("circles/<str:set_id>/invite-links", CircleInviteLinksView.as_view(), name="set_invite_links"),
path("circles/<str:set_id>/invite-links/<str:token>/revoke", CircleInviteLinkRevokeView.as_view(), name="set_invite_link_revoke"),
path("invite-links/<str:token>", InviteLinkPublicView.as_view(), name="invite_link_public"),
path("invite-links/<str:token>/accept", InviteLinkAcceptView.as_view(), name="invite_link_accept"),
]
