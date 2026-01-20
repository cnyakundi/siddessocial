from __future__ import annotations

from django.urls import path

from .views import SearchUsersView, SearchPostsView, UserProfileView, UserPublicPostsView

urlpatterns = [
    path("search/users", SearchUsersView.as_view()),
    path("search/posts", SearchPostsView.as_view()),
    path("users/<str:username>", UserProfileView.as_view()),
    path("users/<str:username>/posts", UserPublicPostsView.as_view()),
]
