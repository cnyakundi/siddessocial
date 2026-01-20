# Email Go-Live (Siddes)

Siddes uses transactional email for:
- Email verification
- Password reset
- Security/account lifecycle messages (later)

Backend code is already in place (`backend/siddes_backend/emailing.py`).
This doc tells you exactly what to set before going live.

## Choose a provider

### Option A: SMTP (simplest)
Set:
- `SD_EMAIL_PROVIDER=smtp`
- `SD_EMAIL_FROM=no-reply@yourdomain.com`
- `SD_SMTP_HOST` (from your SMTP provider)
- `SD_SMTP_USER` / `SD_SMTP_PASSWORD`

### Option B: SendGrid (API)
Set:
- `SD_EMAIL_PROVIDER=sendgrid`
- `SD_EMAIL_FROM=no-reply@yourdomain.com`
- `SD_SENDGRID_API_KEY=<your key>`

## Required: public app base
Set one of these (recommended):
- `SIDDES_PUBLIC_APP_BASE=https://yourdomain.com`

If missing, emails will still include a token users can paste, but links won't be clickable.

## Quick test (no coding)

After setting env vars on your production backend, run:

```bash
python manage.py email_test --to you@example.com
```

Expected output includes `{ 'ok': True, 'provider': 'smtp' }` (or `sendgrid`).

## Launch guard

`python manage.py launch_check --strict`
will now fail the launch if:
- `SD_EMAIL_PROVIDER=console` in production
- SMTP is selected but `SD_SMTP_HOST` is missing
- SendGrid is selected but `SD_SENDGRID_API_KEY` is missing

This prevents "we launched but password reset is broken".
