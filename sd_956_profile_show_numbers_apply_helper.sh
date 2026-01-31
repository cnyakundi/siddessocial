#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT/backend" ] || [ ! -d "$ROOT/frontend" ]; then
  echo "ERROR: Run from your repo root (folder containing backend/ and frontend/), or pass the path."
  echo "Usage: $0 /path/to/sidesroot"
  exit 1
fi

cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_956_profile_show_numbers_${TS}"
mkdir -p "$BK"

backup_file() {
  local rel="$1"
  local src="$ROOT/$rel"
  if [ -f "$src" ]; then
    mkdir -p "$BK/$(dirname "$rel")"
    cp -a "$src" "$BK/$rel"
  fi
}

echo "== sd_956: Profile header numbers (Followers/Following) =="

TARGET="frontend/src/app/u/[username]/page.tsx"
backup_file "$TARGET"

PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "ERROR: python3 (or python) is required."
  exit 1
fi

"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/u/[username]/page.tsx")
t = p.read_text()

# If already wired, exit cleanly.
if "publicFollowers={publicFollowers}" in t and "publicFollowing={publicFollowing}" in t:
    print("OK: publicFollowers/publicFollowing already passed into ProfileV2Header")
    raise SystemExit(0)

needle = "postsCount={postsCount}"
matches = list(re.finditer(re.escape(needle), t))

if not matches:
    raise SystemExit("ERROR: Could not find postsCount={postsCount} in the profile page.")

patched = False

for m in matches:
    idx = m.start()

    # Only patch the one inside ProfileV2Header props (look behind for the component tag)
    lookback = t[max(0, idx - 2000):idx]
    if "<ProfileV2Header" not in lookback:
        continue

    # Avoid double-inserting if some other wiring exists nearby
    lookahead = t[m.end():m.end() + 800]
    if "publicFollowers={" in lookahead or "publicFollowing={" in lookahead:
        print("OK: found ProfileV2Header block already containing follower props nearby")
        patched = True
        break

    # Get indentation from the current line
    line_start = t.rfind("\n", 0, idx)
    line = t[line_start + 1: idx]
    indent = re.match(r"[ \t]*", line).group(0)

    insert = f"\n{indent}publicFollowers={{publicFollowers}}\n{indent}publicFollowing={{publicFollowing}}"
    t = t[:m.end()] + insert + t[m.end():]
    patched = True
    print("OK: inserted publicFollowers/publicFollowing into ProfileV2Header props")
    break

if not patched:
    raise SystemExit("ERROR: Found postsCount={postsCount} but couldn't locate a ProfileV2Header block to patch.")

p.write_text(t)
PY

echo ""
echo "✅ sd_956 applied."
echo "Backups saved to: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Smoke test:"
echo "  Open /u/<username> and confirm Followers / Following show real numbers (not —)."
