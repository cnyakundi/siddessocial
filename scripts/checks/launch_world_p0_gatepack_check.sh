#!/usr/bin/env bash
set -euo pipefail

echo "== Launch P0 Gatepack (World Launch) (sd_751) =="

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ ! -d "$ROOT/frontend" ] && [ -d "$(pwd)/frontend" ]; then
  ROOT="$(pwd)"
fi

fails=0

run_check() {
  local title="$1"
  local rel="$2"

  echo ""
  echo "---- $title ----"
  if (cd "$ROOT" && bash "$rel"); then
    echo "✅ PASS: $title"
  else
    echo "❌ FAIL: $title"
    fails=$((fails+1))
  fi
}

# P0.1 Side boundaries (static leak vectors)
run_check "Caching paranoia (no cross-user / cross-side bleed)" "scripts/checks/caching_paranoia_check.sh"
run_check "Search privacy guardrails (no cross-side search leaks)" "scripts/checks/search_privacy_guardrails_check.sh"
run_check "Deep links + post detail baseline" "scripts/checks/deeplink_check.sh"

# P0.2 Login/session wiring (static wiring)
run_check "Auth bootstrap + shell exclusions" "scripts/checks/auth_bootstrap_check.sh"

# P0.3 Navigation escape surfaces (baseline wiring)
run_check "PWA caching baseline (SW/manifest wired)" "scripts/checks/pwa_cache_check.sh"

# P0.4 Messaging integrity (idempotency baseline)
run_check "Inbox send idempotency (clientKey)" "scripts/checks/inbox_send_idempotency_check.sh"

# P0.7 Safety/abuse fundamentals
run_check "DRF throttling skeleton" "scripts/checks/drf_throttling_skeleton_check.sh"
run_check "Safety endpoints (block/mute/report) wired" "scripts/checks/safety_block_report_check.sh"

# P0.8 Notifications safety baseline (in-app)
run_check "Notifications DB-backed (no mock)" "scripts/checks/notifications_check.sh"

# P0.9 Legal + account lifecycle
run_check "Legal pages present" "scripts/checks/legal_pages_check.sh"
run_check "Account deletion endpoints + pages present" "scripts/checks/account_deletion_check.sh"

# P0.10 Observability readiness
run_check "Observability baseline" "scripts/checks/observability_baseline_check.sh"

echo ""
if [[ "$fails" -ne 0 ]]; then
  echo "== RESULT: FAIL ($fails check(s) failed) =="
  exit 1
fi

echo "== RESULT: PASS (all Launch P0 gatepack checks passed) =="
