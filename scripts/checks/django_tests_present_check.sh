#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"
echo "== Check: Django tests present (sd_148e) =="
grep -q "class PostsApiSmokeTests" backend/siddes_post/tests.py
grep -q "class SetsApiSmokeTests" backend/siddes_sets/tests.py
echo "✅ Django tests exist"
