#!/usr/bin/env bash
set -euo pipefail

# Beginner-friendly wrapper.
# Always invoke via bash so it works even if zip packaging lost executable bits.
exec bash scripts/verify_overlays.sh "$@"
