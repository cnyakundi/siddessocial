#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -f "scripts/dev/p0_gate.sh" ]]; then
  echo "ERROR: missing scripts/dev/p0_gate.sh"
  exit 1
fi

echo "== Siddes Gates (fast truth) =="
echo "Tip: SKIP_HTTP=1 to skip HTTP smoke; SKIP_CHECKS=1 to skip optional checks."
bash scripts/dev/p0_gate.sh
