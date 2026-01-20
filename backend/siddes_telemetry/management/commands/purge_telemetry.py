from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from siddes_telemetry.models import TelemetryEvent


class Command(BaseCommand):
    help = "Purge old TelemetryEvent rows (privacy-safe telemetry)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Retain last N days (default: settings SIDDES_TELEMETRY_RETENTION_DAYS or 30).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many rows would be deleted without deleting.",
        )

    def handle(self, *args, **opts):
        days = opts.get("days")
        if days is None:
            days = int(getattr(settings, "SIDDES_TELEMETRY_RETENTION_DAYS", 30) or 30)

        days = max(1, min(int(days), 3650))
        cutoff = timezone.now() - timedelta(days=days)

        qs = TelemetryEvent.objects.filter(created_at__lt=cutoff)
        count = qs.count()

        if opts.get("dry_run"):
            self.stdout.write(self.style.WARNING(f"Would delete {count} telemetry events older than {days} day(s)."))
            return

        deleted, _ = qs.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} telemetry events older than {days} day(s)."))
