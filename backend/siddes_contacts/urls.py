from django.urls import path

from .views import ContactsMatchView, ContactsSuggestionsView

urlpatterns = [
    path("match", ContactsMatchView.as_view()),
    path("suggestions", ContactsSuggestionsView.as_view()),
]
