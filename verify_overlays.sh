#!/usr/bin/env bash
set -euo pipefail

# Repo-root convenience wrapper (expected by scripts/verify_overlays.sh)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/scripts/verify_overlays.sh" "$@"
