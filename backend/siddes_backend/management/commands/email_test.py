from __future__ import annotations

import os
from typing import Optional

from django.core.management.base import BaseCommand

from siddes_backend.emailing import send_email


class Command(BaseCommand):
    help = "Send a test transactional email using the configured provider (smtp/sendgrid/console)."

    def add_arguments(self, parser):
        parser.add_argument("--to", dest="to", required=True, help="Recipient email address")
        parser.add_argument("--subject", dest="subject", default="Siddes test email", help="Email subject")
        parser.add_argument(
            "--provider",
            dest="provider",
            default="",
            help="Override provider for this run (console|smtp|sendgrid). Otherwise uses SD_EMAIL_PROVIDER.",
        )

    def handle(self, *args, **opts):
        to = str(opts.get("to") or "").strip()
        subject = str(opts.get("subject") or "Siddes test email").strip()[:140]
        provider = str(opts.get("provider") or "").strip().lower()

        if provider:
            os.environ["SD_EMAIL_PROVIDER"] = provider

        text = "".join(
            [
                "Siddes transactional email test.\n\n",
                "If you received this, your email provider is configured correctly.\n",
            ]
        )

        res = send_email(to=to, subject=subject, text=text, html=None, request_id="email_test")
        ok = bool(res.get("ok"))
        self.stdout.write(str(res))
        if not ok:
            raise SystemExit(1)
