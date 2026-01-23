from django.urls import path

from .views import PrismView, ProfileView, SideActionView, FollowActionView

urlpatterns = [
    path("prism", PrismView.as_view(), name="prism"),
    path("profile/<str:username>", ProfileView.as_view(), name="profile"),
    path("side", SideActionView.as_view(), name="side_action"),
    path("follow", FollowActionView.as_view(), name="follow_action"),
]
