"""URL routing for Siddes Media (DRF)."""

from django.urls import path

from .views import MediaCommitView, MediaSignUploadView, MediaSignedUrlView

urlpatterns = [
    path("media/sign-upload", MediaSignUploadView.as_view()),
    path("media/commit", MediaCommitView.as_view()),
    path("media/url", MediaSignedUrlView.as_view()),
]
