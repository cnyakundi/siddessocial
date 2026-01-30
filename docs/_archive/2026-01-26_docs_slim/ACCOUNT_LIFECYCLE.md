# Siddes — Account lifecycle (sd_324)

This workstream closes the “real-world account” loop:

## 1) Change email

### Request
`POST /api/auth/email/change/request`

Body:
```json
{ "newEmail": "new@example.com", "password": "(optional)" }
```

Notes:
- Requires session.
- In production, password re-entry is required by default when the user has a usable password.
  Override with `SIDDES_EMAIL_CHANGE_REQUIRE_PASSWORD=0`.

### Confirm
`POST /api/auth/email/change/confirm`

Body:
```json
{ "token": "..." }
```

Result:
- Updates the user email.
- Marks email as verified.
- Logs the user in (returns session payload).


## 2) Deactivate account

`POST /api/auth/account/deactivate`

Result:
- Circles `user.is_active=false`
- Circles `SiddesProfile.account_state=suspended`
- Revokes all sessions and logs out


## 3) Delete account (soft-delete)

### Request delete
`POST /api/auth/account/delete/request`

Requires:
- Verified email

### Confirm delete
`POST /api/auth/account/delete/confirm`

Body:
```json
{ "token": "..." }
```

Soft-delete behavior:
- disables account (`is_active=false`)
- scrubs email/name
- renames username to a `deleted_*` handle
- revokes all sessions


## 4) Export my data

`GET /api/auth/export?limit=1000`

Returns JSON export (profile + sets + posts + replies + blocks + reports).


## Env knobs

- `SIDDES_EMAIL_CHANGE_TTL_HOURS` (default 2)
- `SIDDES_ACCOUNT_DELETE_TTL_HOURS` (default 2)

Throttles:
- `SIDDES_THROTTLE_AUTH_EMAIL_CHANGE_REQUEST` (default 10/hour)
- `SIDDES_THROTTLE_AUTH_EMAIL_CHANGE_CONFIRM` (default 30/min)
- `SIDDES_THROTTLE_AUTH_ACCOUNT_DEACTIVATE` (default 5/hour)
- `SIDDES_THROTTLE_AUTH_ACCOUNT_DELETE_REQUEST` (default 5/hour)
- `SIDDES_THROTTLE_AUTH_ACCOUNT_DELETE_CONFIRM` (default 30/min)
- `SIDDES_THROTTLE_AUTH_EXPORT` (default 10/min)

Link base for confirmation emails:
- `SIDDES_PUBLIC_APP_BASE` (preferred)
- `SD_PUBLIC_APP_BASE`
