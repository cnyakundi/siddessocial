from __future__ import annotations

from django.urls import path

from .views import MlSuggestionActionView, MlSuggestionsView

urlpatterns = [
    path("ml/suggestions", MlSuggestionsView.as_view()),
    path("ml/suggestions/<str:suggestion_id>/<str:action>", MlSuggestionActionView.as_view()),
]
