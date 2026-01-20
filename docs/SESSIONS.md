# Siddes — Device & Session Management (sd_322)

This workstream adds a minimal **security cockpit** for users:
- list active sessions/devices
- revoke a specific session
- log out other devices

## Backend

### Tracked session table
`siddes_auth.UserSession`
- `session_key` (unique)
- ip, user_agent
- created_at, last_seen_at
- revoked_at

### Middleware
`UserSessionCaptureMiddleware`
- records/updates a UserSession row for authenticated requests
- if a session is marked revoked → forces logout (deny-by-default)
- updates last_seen_at at most once per 60 seconds

### Endpoints
- `GET /api/auth/sessions`
- `POST /api/auth/sessions/revoke` body: `{ "id": <UserSession.id> }`
- `POST /api/auth/sessions/logout_all` body: `{ "includeCurrent": false }`

## Frontend
- `/siddes-profile/account/sessions`

## Notes
- IP uses `X-Forwarded-For` first hop when present.
- For scale later: consider moving session tracking updates to a queue.
