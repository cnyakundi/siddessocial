#!/usr/bin/env bash
set -euo pipefail

# no_fake_surface_check.sh
# Fails if demo/mock modules or placeholder strings remain in runtime surfaces.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Exclude backup dirs + node_modules + build outputs
EXCLUDES=(
  "--exclude-dir=.backup*"
  "--exclude-dir=node_modules"
  "--exclude-dir=frontend/.next"
  "--exclude-dir=frontend/.turbo"
  "--exclude=*.bak*"
)

PATTERN='MOCK_POSTS|RELATIONSHIPS|POST_CONTENT|siddes_feed\.mock_db|detail_stub|mockFeed|mockNotifications|mockUsers|mockPublicSlate|Coming soon|next brick|\(stub\)' 

if grep -RInE "${EXCLUDES[@]}" "$PATTERN" backend frontend >/dev/null 2>&1; then
  echo "❌ Found demo/mock/placeholder surface:" 1>&2
  grep -RInE "${EXCLUDES[@]}" "$PATTERN" backend frontend | head -n 200 1>&2
  exit 1
fi

echo "✅ no_fake_surface_check: clean"
