from django.urls import path

from .views import TelemetryIngestView, TelemetrySummaryView

urlpatterns = [
    path("ingest", TelemetryIngestView.as_view(), name="telemetry_ingest"),
    path("summary", TelemetrySummaryView.as_view(), name="telemetry_summary"),
]
