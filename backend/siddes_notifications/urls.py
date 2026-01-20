from __future__ import annotations

from django.urls import path

from .views import NotificationsListView, NotificationsMarkAllReadView

urlpatterns = [
    path("notifications", NotificationsListView.as_view()),
    path("notifications/mark-all-read", NotificationsMarkAllReadView.as_view()),
]
