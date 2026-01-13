#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox visibility enforcement (InMemoryInboxStore) =="

FILE="backend/siddes_inbox/store_memory.py"

if [[ ! -f "${FILE}" ]]; then
  echo "❌ Missing: ${FILE}"
  exit 1
fi

must_grep () {
  local pat="$1"
  if ! grep -q "${pat}" "${FILE}"; then
    echo "❌ ${FILE} missing pattern: ${pat}"
    exit 1
  fi
}

# Core helpers
must_grep "def _viewer_role"
must_grep "def _role_can_view"

# list_threads must filter by role
must_grep "_role_can_view(role, self._threads\[tid\].locked_side)"

# get_thread must block unauthorized access
must_grep "if not _role_can_view(role, self._threads\[thread_id\].locked_side)"
must_grep "raise KeyError(\"restricted\")"

# set_locked_side must be me-only
must_grep "if role != \"me\""

echo "✅ Visibility enforcement detected in InMemoryInboxStore."
