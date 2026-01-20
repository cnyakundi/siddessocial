from django.urls import path

from .views import (
    BroadcastWritersView,
    BroadcastFeedView,
    BroadcastUnreadView,
    BroadcastSeenView,
    BroadcastsView,
    BroadcastDetailView,
    BroadcastFollowView,
    BroadcastUnfollowView,
    BroadcastNotifyView,
    BroadcastPostsView,
)

urlpatterns = [
    path("broadcasts", BroadcastsView.as_view()),
    path("broadcasts/feed", BroadcastFeedView.as_view()),
    path("broadcasts/unread", BroadcastUnreadView.as_view()),
    path("broadcasts/<str:broadcast_id>", BroadcastDetailView.as_view()),
    path("broadcasts/<str:broadcast_id>/follow", BroadcastFollowView.as_view()),
    path("broadcasts/<str:broadcast_id>/unfollow", BroadcastUnfollowView.as_view()),
    path("broadcasts/<str:broadcast_id>/notify", BroadcastNotifyView.as_view()),
    path("broadcasts/<str:broadcast_id>/seen", BroadcastSeenView.as_view()),
    path("broadcasts/<str:broadcast_id>/writers", BroadcastWritersView.as_view()),
    path("broadcasts/<str:broadcast_id>/posts", BroadcastPostsView.as_view()),
]
