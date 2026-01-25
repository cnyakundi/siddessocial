from django.urls import path

from .views import PrismView, ProfileView, SideActionView, SidersLedgerView, AccessRequestsView, AccessRequestRespondView

urlpatterns = [
    path("prism", PrismView.as_view(), name="prism"),
    path("profile/<str:username>", ProfileView.as_view(), name="profile"),
    path("side", SideActionView.as_view(), name="side_action"),
    path("siders", SidersLedgerView.as_view(), name="siders_ledger"),
    path("access-requests", AccessRequestsView.as_view(), name="access_requests"),
    path("access-requests/<str:rid>/respond", AccessRequestRespondView.as_view(), name="access_request_respond"),
]
