from django.urls import path

from .views import PrismView, ProfileView, SideActionView

urlpatterns = [
    path("prism", PrismView.as_view(), name="prism"),
    path("profile/<str:username>", ProfileView.as_view(), name="profile"),
    path("side", SideActionView.as_view(), name="side_action"),
]
