#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
echo "== PWA checks =="

PUBLIC_DIR=""
for d in "frontend/public" "public"; do
  if [[ -d "${d}" ]]; then
    PUBLIC_DIR="${d}"
    break
  fi
done

if [[ -z "${PUBLIC_DIR}" ]]; then
  echo "❌ Could not find public directory (frontend/public or public)."
  exit 1
fi

MANIFEST="${PUBLIC_DIR}/manifest.webmanifest"
SW="${PUBLIC_DIR}/sw.js"
CLIENT="${PUBLIC_DIR}/pwa-client.js"
OFFLINE="${PUBLIC_DIR}/offline.html"

for f in "${MANIFEST}" "${SW}" "${CLIENT}" "${OFFLINE}"; do
  if [[ ! -f "${f}" ]]; then
    echo "❌ Missing: ${f}"
    exit 1
  fi
done

for icon in "${PUBLIC_DIR}/icons/icon-192.png" "${PUBLIC_DIR}/icons/icon-512.png" "${PUBLIC_DIR}/icons/maskable-192.png" "${PUBLIC_DIR}/icons/maskable-512.png"; do
  if [[ ! -f "${icon}" ]]; then
    echo "❌ Missing icon: ${icon}"
    exit 1
  fi
done

# Validate manifest JSON using python (works everywhere)
python3 - <<'PY'
import json, pathlib
p = pathlib.Path(__import__("sys").argv[1])
data = json.loads(p.read_text(encoding="utf-8"))
required = ["name","short_name","start_url","scope","display","icons"]
missing = [k for k in required if k not in data]
if missing:
    raise SystemExit(f"Manifest missing keys: {missing}")
if not isinstance(data.get("icons"), list) or len(data["icons"]) < 2:
    raise SystemExit("Manifest icons list is missing/too small")
print("✅ manifest.webmanifest JSON valid")
PY "${MANIFEST}"

echo "✅ PWA assets present in ${PUBLIC_DIR}"
