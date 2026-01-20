from django.db import models


class TelemetryEvent(models.Model):
    # Privacy-safe telemetry: counts-only events with no PII.
    # We store only: viewer_id (string), event name, and timestamp.
    #
    # IMPORTANT:
    # - Never store handles
    # - Never store contact identifiers
    # - Never store raw names/text
    viewer_id = models.CharField(max_length=64)
    event = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["viewer_id", "event", "created_at"]),
        ]
