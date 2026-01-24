from django.urls import path

from .views import SignupView, LoginView, LogoutView, MeView, GoogleAuthView, UsernameSetView, OnboardingCompleteView, RegionView, AgeGateConfirmView
from .password_reset import PasswordResetRequestView, PasswordResetConfirmView, PasswordChangeView
from .email_verification import VerifyConfirmView, VerifyResendView
from .account_lifecycle import (
    EmailChangeRequestView,
    EmailChangeConfirmView,
    AccountDeactivateView,
    AccountDeleteRequestView,
    AccountDeleteConfirmView,
    ExportDataView,
)
from .sessions import SessionsListView, SessionsRevokeView, SessionsLogoutAllView
from .connected import ConnectedAuthMethodsView

from .magic_link import MagicLinkRequestView, MagicLinkConsumeView

urlpatterns = [
    path("magic/request", MagicLinkRequestView.as_view()),
    path("magic/consume", MagicLinkConsumeView.as_view()),
    path("signup", SignupView.as_view()),
    path("login", LoginView.as_view()),
    path("logout", LogoutView.as_view()),
    path("me", MeView.as_view()),
    path("connected", ConnectedAuthMethodsView.as_view()),
    path("region", RegionView.as_view()),
    path("age/confirm", AgeGateConfirmView.as_view()),
    path("verify/confirm", VerifyConfirmView.as_view()),
    path("verify/resend", VerifyResendView.as_view()),
    path("google", GoogleAuthView.as_view()),
    path("username/set", UsernameSetView.as_view()),
    path("onboarding/complete", OnboardingCompleteView.as_view()),
    path("password/reset/request", PasswordResetRequestView.as_view()),
    path("password/reset/confirm", PasswordResetConfirmView.as_view()),
    path("password/change", PasswordChangeView.as_view()),
    path("sessions", SessionsListView.as_view()),
    path("sessions/revoke", SessionsRevokeView.as_view()),
    path("sessions/logout_all", SessionsLogoutAllView.as_view()),
    path("email/change/request", EmailChangeRequestView.as_view()),
    path("email/change/confirm", EmailChangeConfirmView.as_view()),
    path("account/deactivate", AccountDeactivateView.as_view()),
    path("account/delete/request", AccountDeleteRequestView.as_view()),
    path("account/delete/confirm", AccountDeleteConfirmView.as_view()),
    path("export", ExportDataView.as_view()),
]
