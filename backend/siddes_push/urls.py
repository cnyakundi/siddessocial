from __future__ import annotations

from django.urls import path

from .views import PushDebugSendView, PushPrefsView, PushStatusView, PushSubscribeView, PushUnsubscribeView

urlpatterns = [
    path("status", PushStatusView.as_view()),
    path("subscribe", PushSubscribeView.as_view()),
    path("unsubscribe", PushUnsubscribeView.as_view()),
    path("prefs", PushPrefsView.as_view()),
    path("debug/send", PushDebugSendView.as_view()),
]
