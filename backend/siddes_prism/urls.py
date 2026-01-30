from django.urls import path

from .views import PrismView, ProfileView, SideActionView, SidersLedgerView, FollowersLedgerView, AccessRequestsView, AccessRequestRespondView, FollowActionView, PublicFollowersView, PublicFollowingView

urlpatterns = [
    path("prism", PrismView.as_view(), name="prism"),
    path("profile/<str:username>", ProfileView.as_view(), name="profile"),
    path("side", SideActionView.as_view(), name="side_action"),
    path("follow", FollowActionView.as_view(), name="follow_action"),
    path("public-followers/<str:username>", PublicFollowersView.as_view(), name="public_followers"),
    path("public-following/<str:username>", PublicFollowingView.as_view(), name="public_following"),
    path("siders", SidersLedgerView.as_view(), name="siders_ledger"),
    path("followers", FollowersLedgerView.as_view(), name="followers_ledger"),
    path("access-requests", AccessRequestsView.as_view(), name="access_requests"),
    path("access-requests/<str:rid>/respond", AccessRequestRespondView.as_view(), name="access_request_respond"),
]
