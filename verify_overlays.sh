#!/usr/bin/env bash
set -euo pipefail

# Beginner-proof wrapper:
# Always invoke the real verifier via bash so it works even if the executable bit
# was lost (common when overlay zips overwrite scripts on macOS).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${ROOT}/scripts/verify_overlays.sh"
