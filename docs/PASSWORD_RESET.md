# Siddes - Password reset + change password (Workstream 0.3)

This ships the account recovery essentials:
- Password reset request + confirm (email-based)
- Change password for authenticated users

## Endpoints

### Request reset
`POST /api/auth/password/reset/request`

Body:
```json
{ "identifier": "email-or-username" }
```

Response:
- Always returns `200 { ok: true }` (does not leak whether account exists)

### Confirm reset
`POST /api/auth/password/reset/confirm`

Body:
```json
{ "token": "…", "password": "new_password" }
```

Notes:
- Tokens are hashed in DB, expiring, single-use.
- On success: user is logged in (session payload returned).

### Change password
`POST /api/auth/password/change`

Body:
```json
{ "oldPassword": "current", "newPassword": "next" }
```

Notes:
- Requires session authentication.
- If a user has no usable password (Google-only), `oldPassword` may be blank.

## Env knobs

- `SIDDES_PASSWORD_RESET_TTL_HOURS` (default 2)
- `SIDDES_PASSWORD_RESET_COOLDOWN_SEC` (default 60)
- `SIDDES_THROTTLE_AUTH_PW_RESET_REQUEST` (default 5/hour)
- `SIDDES_THROTTLE_AUTH_PW_RESET_CONFIRM` (default 30/min)
- `SIDDES_THROTTLE_AUTH_PW_CHANGE` (default 10/min)

Email link base (same as verification):
- `SIDDES_PUBLIC_APP_BASE` (preferred)
- `SD_PUBLIC_APP_BASE`

## Quick dev proof

Run backend with console email (token appears in logs):
```bash
cd backend
SD_EMAIL_PROVIDER=console SD_EMAIL_FROM=no-reply@siddes.local \
python manage.py runserver 0.0.0.0:8000
```

Flow:
1) Open `http://localhost:3000/forgot-password`
2) Request reset
3) Copy token from backend logs
4) Open `http://localhost:3000/reset-password?token=...`
5) Set new password and confirm you can login
