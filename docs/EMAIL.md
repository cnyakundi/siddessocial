# Siddes — Transactional Email (Launch Part 0 / Workstream 0.1)

This doc defines the **minimum email foundation** required for a global launch.

Email is required for:
- Email verification
- Password reset
- Security alerts (later)

The implementation lives in:
- `backend/siddes_backend/emailing.py`
- `backend/siddes_auth/management/commands/send_test_email.py`

---

## Provider selection

Choose provider via env var:
- `SD_EMAIL_PROVIDER=console|smtp|sendgrid`

Defaults:
- Dev (`DJANGO_DEBUG=1`): `console`
- Prod (`DJANGO_DEBUG=0`): `smtp`

From address:
- `SD_EMAIL_FROM=no-reply@yourdomain.com`

---

## Provider: console (dev)

Prints a redacted email preview to structured logs (`siddes.api`).

Example:
```bash
cd backend
SD_EMAIL_PROVIDER=console SD_EMAIL_FROM=no-reply@siddes.local \
  python manage.py send_test_email you@example.com
```

---

## Provider: smtp (recommended for prod)

Env vars:
- `SD_SMTP_HOST`
- `SD_SMTP_PORT` (default 587)
- `SD_SMTP_USER`
- `SD_SMTP_PASSWORD`
- `SD_SMTP_USE_TLS` (default 1)
- `SD_SMTP_USE_SSL` (default 0)
- `SD_SMTP_TIMEOUT` (default 10)

Example:
```bash
cd backend
SD_EMAIL_PROVIDER=smtp \
SD_EMAIL_FROM=no-reply@yourdomain.com \
SD_SMTP_HOST=smtp.yourprovider.com \
SD_SMTP_PORT=587 \
SD_SMTP_USER=your_user \
SD_SMTP_PASSWORD=your_pass \
SD_SMTP_USE_TLS=1 \
python manage.py send_test_email you@example.com
```

---

## Provider: sendgrid (HTTP)

Requires:
- `SD_SENDGRID_API_KEY`

Example:
```bash
cd backend
SD_EMAIL_PROVIDER=sendgrid SD_EMAIL_FROM=no-reply@yourdomain.com SD_SENDGRID_API_KEY=... \
  python manage.py send_test_email you@example.com
```

---

## Operational notes

- Log events:
  - `email_console`
  - `email_send`
  - `email_send_failed`

- Do **not** log full email bodies in production.
- Deliverability (bounces/spam) is provider-specific; wire provider alerts once you have volume.
