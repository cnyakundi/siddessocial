from django.urls import path

from .views import RitualDetailView, RitualIgniteView, RitualRespondView, RitualResponsesView, RitualsView

urlpatterns = [
    path("rituals", RitualsView.as_view()),
    path("rituals/<str:ritual_id>", RitualDetailView.as_view()),
    path("rituals/<str:ritual_id>/ignite", RitualIgniteView.as_view()),
    path("rituals/<str:ritual_id>/respond", RitualRespondView.as_view()),
    path("rituals/<str:ritual_id>/responses", RitualResponsesView.as_view()),
]
