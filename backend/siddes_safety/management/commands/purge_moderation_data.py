from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from siddes_safety.models import ModerationAuditEvent, UserReport


class Command(BaseCommand):
    help = "Purge old moderation audit events and resolved/dismissed reports (retention policy)."

    def add_arguments(self, parser):
        parser.add_argument("--audit-days", type=int, default=None, help="Retention window for ModerationAuditEvent")
        parser.add_argument("--report-days", type=int, default=None, help="Retention window for resolved/dismissed UserReport")
        parser.add_argument("--dry-run", action="store_true", help="Print counts only, do not delete")

    def handle(self, *args, **opts):
        audit_days = opts.get("audit_days")
        report_days = opts.get("report_days")
        dry = bool(opts.get("dry_run"))

        if audit_days is None:
            audit_days = int(getattr(settings, "SIDDES_MOD_AUDIT_RETENTION_DAYS", 365))
        if report_days is None:
            report_days = int(getattr(settings, "SIDDES_REPORT_RETENTION_DAYS", 365))

        audit_days = max(1, int(audit_days))
        report_days = max(1, int(report_days))

        now = timezone.now()
        audit_cut = now - timedelta(days=audit_days)
        report_cut = now - timedelta(days=report_days)

        audit_qs = ModerationAuditEvent.objects.filter(created_at__lt=audit_cut)
        rep_qs = UserReport.objects.filter(created_at__lt=report_cut, status__in=["resolved", "dismissed"])

        audit_count = audit_qs.count()
        rep_count = rep_qs.count()

        self.stdout.write(self.style.WARNING("Retention policy purge"))
        self.stdout.write(f"- Audit events older than {audit_days}d: {audit_count}")
        self.stdout.write(f"- Resolved/dismissed reports older than {report_days}d: {rep_count}")

        if dry:
            self.stdout.write(self.style.SUCCESS("Dry run: no deletions."))
            return

        if audit_count:
            audit_qs.delete()
        if rep_count:
            rep_qs.delete()

        self.stdout.write(self.style.SUCCESS("Purge complete."))
