#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox models + migrations scaffold =="

# App registered
grep -q "siddes_inbox.apps.SiddesInboxConfig" backend/siddes_backend/settings.py

# Files exist
[[ -f "backend/siddes_inbox/apps.py" ]]
[[ -f "backend/siddes_inbox/models.py" ]]
[[ -f "backend/siddes_inbox/migrations/0001_initial.py" ]]

# Models present
grep -q "class InboxThread" backend/siddes_inbox/models.py
grep -q "class InboxMessage" backend/siddes_inbox/models.py

echo "✅ Inbox models + migrations scaffold present"
