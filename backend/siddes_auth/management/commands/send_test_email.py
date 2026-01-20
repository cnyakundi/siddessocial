from __future__ import annotations

from django.core.management.base import BaseCommand

from siddes_backend.emailing import send_email


class Command(BaseCommand):
    help = "Send a test email using Siddes EmailService (Launch Part 0 / 0.1)."

    def add_arguments(self, parser):
        parser.add_argument("to", help="Recipient email address")
        parser.add_argument("--subject", default="Siddes test email", help="Email subject")
        parser.add_argument(
            "--text",
            default="Hello from Siddes. If you received this, transactional email is wired.",
            help="Plain text body",
        )
        parser.add_argument("--html", default="", help="Optional HTML body")

    def handle(self, *args, **opts):
        to = str(opts.get("to") or "").strip()
        subject = str(opts.get("subject") or "Siddes test email").strip()
        text = str(opts.get("text") or "").strip()
        html = str(opts.get("html") or "").strip() or None

        if not to or "@" not in to:
            self.stderr.write(self.style.ERROR("Invalid recipient email."))
            raise SystemExit(2)

        res = send_email(to=to, subject=subject, text=text, html=html, request_id="managepy")
        if not bool(res.get("ok")):
            self.stderr.write(self.style.ERROR(f"FAILED: {res}"))
            raise SystemExit(1)

        provider = str(res.get("provider") or "")
        self.stdout.write(self.style.SUCCESS(f"OK ({provider}): {res}"))
