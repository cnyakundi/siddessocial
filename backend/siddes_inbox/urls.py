"""URL routing for the Inbox API (DRF)."""

from __future__ import annotations

from django.urls import path

from .views import (
    InboxDebugIncomingView,
    InboxDebugResetUnreadView,
    InboxThreadView,
    InboxThreadsView,
)

urlpatterns = [
    path("threads", InboxThreadsView.as_view(), name="inbox_threads"),
    path("thread/<str:thread_id>", InboxThreadView.as_view(), name="inbox_thread"),

    # Dev-only debug tools (viewer=me + DJANGO_DEBUG=1)
    path("debug/unread/reset", InboxDebugResetUnreadView.as_view(), name="inbox_debug_unread_reset"),
    path("debug/incoming", InboxDebugIncomingView.as_view(), name="inbox_debug_incoming"),
]
