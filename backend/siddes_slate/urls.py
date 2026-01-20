from __future__ import annotations

from django.urls import path

from .views import PublicSlateListView

urlpatterns = [
    path("slate", PublicSlateListView.as_view()),
]
