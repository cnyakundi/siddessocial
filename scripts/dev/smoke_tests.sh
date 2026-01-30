#!/usr/bin/env bash
set -euo pipefail

# Dev smoke tests for Siddes (local docker-compose dev stack)
# Uses curl only; no jq dependency.

BACKEND="${SIDDES_BACKEND_URL:-http://localhost:8000}"
FRONTEND="${SIDDES_FRONTEND_URL:-http://localhost:3000}"
VIEWER="${SIDDES_VIEWER_ID:-me_1}"

ok() { echo "OK  $*"; }
warn() { echo "WARN $*"; }
die() { echo "ERR  $*" 1>&2; exit 1; }

echo "== Siddes dev smoke tests =="
echo "backend:  $BACKEND"
echo "frontend: $FRONTEND"
echo "viewer:   $VIEWER"
echo

# 1) backend health
code="$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/healthz" || true)"
[ "$code" = "200" ] || die "healthz failed ($code)"
ok "backend /healthz 200"

# 2) auth/me via frontend proxy
code="$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/api/auth/me" || true)"
[ "$code" = "200" ] || die "frontend /api/auth/me failed ($code)"
ok "frontend /api/auth/me 200"

# 3) sets list (dev viewer header)
code="$(curl -s -H "x-sd-viewer: $VIEWER" -o /dev/null -w "%{http_code}" "$BACKEND/api/circles?side=friends" || true)"
[ "$code" = "200" ] || die "backend /api/circles failed ($code)"
ok "backend /api/circles 200"

# 4) telemetry summary (optional)
tcode="$(curl -s -H "x-sd-viewer: $VIEWER" -o /dev/null -w "%{http_code}" "$BACKEND/api/telemetry/summary?days=7" || true)"
if [ "$tcode" = "200" ]; then
  ok "backend /api/telemetry/summary 200"
else
  warn "telemetry summary not 200 ($tcode) - may be disabled or not migrated"
fi

# 5) contacts match (shape check)
resp="$(curl -s -H "x-sd-viewer: $VIEWER" -H "content-type: application/json" \
  -d '{"identifiers":["test@example.com","+254700000000"]}' \
  "$BACKEND/api/contacts/match" || true)"

echo "$resp" | grep -q '"ok":true' || warn "contacts/match response missing ok:true"
echo "$resp" | grep -q '"matches"' || warn "contacts/match response missing matches field"
ok "backend /api/contacts/match responded"

echo
ok "smoke tests finished"
