from __future__ import annotations

import os
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from siddes_auth.models import SiddesProfile


class Command(BaseCommand):
    help = "Ensure a deterministic perf user exists and is fully onboarded (dev/CI tooling)."

    def add_arguments(self, parser):
        parser.add_argument("--username", default=os.environ.get("SD_PERF_USERNAME", "perf"))
        parser.add_argument("--email", default=os.environ.get("SD_PERF_EMAIL", "perf@example.com"))
        parser.add_argument("--password", default=os.environ.get("SD_PERF_PASSWORD", "perf_pass_12345"))
        parser.add_argument("--no-reset-password", action="store_true", help="Do not overwrite password if user exists.")
        parser.add_argument("--print-json", action="store_true", help="Print JSON payload instead of plain viewerId.")

    def handle(self, *args, **opts):
        # Safety: avoid accidentally creating a known-user in production environments.
        if not getattr(settings, "DEBUG", False) and os.environ.get("SIDDES_ALLOW_PERF_USER", "") != "1":
            self.stderr.write(self.style.ERROR("Refusing to run with DJANGO_DEBUG=0. Set SIDDES_ALLOW_PERF_USER=1 to override."))
            raise SystemExit(2)

        username = str(opts.get("username") or "perf").strip()[:24] or "perf"
        email = str(opts.get("email") or "perf@example.com").strip().lower()
        password = str(opts.get("password") or "perf_pass_12345").strip()
        no_reset = bool(opts.get("no_reset_password"))

        User = get_user_model()

        with transaction.atomic():
            u = User.objects.filter(username__iexact=username).first()
            created = False
            if not u:
                u = User.objects.create_user(username=username, email=email, password=password)
                created = True
            else:
                changed = False
                if email and getattr(u, "email", "") != email:
                    u.email = email
                    changed = True
                if password and not no_reset:
                    u.set_password(password)
                    changed = True
                if getattr(u, "is_active", True) is not True:
                    u.is_active = True
                    changed = True
                if changed:
                    u.save()

            prof, _ = SiddesProfile.objects.get_or_create(user=u)
            now = timezone.now()

            # Make sure the session UX doesn't redirect to onboarding during perf runs.
            prof.onboarding_completed = True
            prof.onboarding_step = "done"
            prof.contact_sync_done = True

            prof.age_gate_confirmed = True
            prof.age_gate_confirmed_at = prof.age_gate_confirmed_at or now

            prof.email_verified = True
            prof.email_verified_at = prof.email_verified_at or now

            prof.account_state = "active"
            prof.save()

        viewer_id = f"me_{getattr(u, 'id', '')}"

        if bool(opts.get("print_json")):
            import json
            self.stdout.write(json.dumps({"viewerId": viewer_id, "userId": getattr(u, "id", None), "created": created}))
        else:
            self.stdout.write(viewer_id)
