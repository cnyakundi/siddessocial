from django.urls import path

from .views import PostCreateView, PostDetailView, PostRepliesView, PostReplyCreateView, PostLikeView, PostEchoView, PostQuoteEchoView

urlpatterns = [
    path("post", PostCreateView.as_view()),
    path("post/<str:post_id>", PostDetailView.as_view()),
    path("post/<str:post_id>/replies", PostRepliesView.as_view()),
    path("post/<str:post_id>/reply", PostReplyCreateView.as_view()),
    path("post/<str:post_id>/like", PostLikeView.as_view()),
    path("post/<str:post_id>/echo", PostEchoView.as_view()),
    path("post/<str:post_id>/quote", PostQuoteEchoView.as_view()),
]
