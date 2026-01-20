from __future__ import annotations

from django.urls import path

from .views import (
    BlockDeleteView,
    MuteDeleteView,
    BlocksView,
    MutesView,
    HiddenPostsView,
    ReportsCreateView,
    AppealsView,
    # staff-only moderation
    ReportsAdminListView,
    ReportsAdminExportView,
    ReportAdminUpdateView,
    AppealsAdminListView,
    AppealAdminUpdateView,
    ModerationPostUpdateView,
    ModerationUserStateView,
    ModerationStatsView,
    ModerationStatsExportView,
    ModerationAuditListView,
    ModerationAuditExportView,
)

urlpatterns = [
    path("blocks", BlocksView.as_view()),
    path("blocks/<path:token>", BlockDeleteView.as_view()),

    path("mutes", MutesView.as_view()),
    path("mutes/<path:token>", MuteDeleteView.as_view()),

    path("hidden-posts", HiddenPostsView.as_view()),

    path("reports", ReportsCreateView.as_view()),
    path("appeals", AppealsView.as_view()),

    # staff-only moderation
    path("reports/admin", ReportsAdminListView.as_view()),
    path("reports/admin/export", ReportsAdminExportView.as_view()),
    path("reports/<int:pk>", ReportAdminUpdateView.as_view()),

    path("appeals/admin", AppealsAdminListView.as_view()),
    path("appeals/<int:pk>", AppealAdminUpdateView.as_view()),

    path("moderation/posts/<str:post_id>", ModerationPostUpdateView.as_view()),
    path("moderation/users/state", ModerationUserStateView.as_view()),
    path("moderation/stats", ModerationStatsView.as_view()),
    path("moderation/stats/export", ModerationStatsExportView.as_view()),
    path("moderation/audit", ModerationAuditListView.as_view()),
    path("moderation/audit/export", ModerationAuditExportView.as_view()),
]
