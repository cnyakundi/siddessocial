#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT/frontend" ] || [ ! -f "$ROOT/frontend/src/components/ProfileV2Header.tsx" ]; then
  echo "ERROR: Expected Siddes repo root with frontend/src/components/ProfileV2Header.tsx"
  echo "Usage: $0 /path/to/sidesroot"
  exit 1
fi

cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_957_profile_follow_lists_tappable_${TS}"
mkdir -p "$BK/frontend/src/components"
cp -a "frontend/src/components/ProfileV2Header.tsx" "$BK/frontend/src/components/ProfileV2Header.tsx"

PYBIN=""
if command -v python3 >/dev/null 2>&1; then PYBIN="python3"; elif command -v python >/dev/null 2>&1; then PYBIN="python"; else
  echo "ERROR: python3 (or python) is required."
  exit 1
fi

"$PYBIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/ProfileV2Header.tsx")
t = p.read_text()

# Already done?
if "sd_957_profile_follow_lists_tappable" in t or "Open followers list" in t:
    print("OK: sd_957 already applied (or equivalent link wrapper exists).")
    raise SystemExit(0)

# 1) Ensure Link import exists
if 'import Link from "next/link";' not in t:
    m = re.search(r'(^\s*import React from "react";\s*\n)', t, flags=re.M)
    if not m:
        raise SystemExit('ERROR: Could not find: import React from "react";')
    t = t[:m.end()] + 'import Link from "next/link";\n' + t[m.end():]

# 2) Ensure href vars inside stats IIFE (after sharedCount)
anchor = 'const sharedCount = Array.isArray(sharedSets) ? sharedSets.length : 0;'
if anchor not in t:
    raise SystemExit("ERROR: Could not find stats sharedCount line to anchor insertion.")

if "const followersHref" not in t and "const followingHref" not in t:
    insert = (
        anchor
        + "\n"
        + '    // sd_957_profile_follow_lists_tappable\n'
        + '    const slug = safeHandle.replace(/^@/, "").split(/\\s+/)[0]?.trim();\n'
        + '    const followersHref = slug ? `/u/${encodeURIComponent(slug)}/followers` : null;\n'
        + '    const followingHref = slug ? `/u/${encodeURIComponent(slug)}/following` : null;'
    )
    t = t.replace(anchor, insert, 1)

# 3) Wrap Followers/Following stats with Link
def wrap_stat(label: str, href_var: str, aria: str):
    pattern = re.compile(
        rf'<Stat\s+label="{re.escape(label)}"\s+value=\{{([^}}]*)\}}\s+subtle\s*/>',
        re.M
    )
    m = pattern.search(t)
    if not m:
        raise SystemExit(f'ERROR: Could not locate Stat line for "{label}".')
    value_expr = m.group(1).strip()

    repl = (
        f'{{{href_var} ? (\n'
        f'              <Link\n'
        f'                href={{{href_var}}}\n'
        f'                className="block rounded-xl px-2 py-1 -mx-2 -my-1 hover:bg-gray-50 transition-colors"\n'
        f'                aria-label="{aria}"\n'
        f'              >\n'
        f'                <Stat label="{label}" value={{{value_expr}}} subtle />\n'
        f'              </Link>\n'
        f'            ) : (\n'
        f'              <Stat label="{label}" value={{{value_expr}}} subtle />\n'
        f'            )}}'
    )
    return pattern.sub(repl, t, count=1)

t = wrap_stat("Followers", "followersHref", "Open followers list")
t = wrap_stat("Following", "followingHref", "Open following list")

p.write_text(t)
print("OK: sd_957 applied (Followers/Following stats are now tappable).")
PY

echo ""
echo "✅ sd_957 applied."
echo "Backups saved to: $BK"
echo ""
echo "Next (VS Code terminal):"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Open /u/<username> on Public"
echo "  2) Tap Followers -> should open /u/<username>/followers"
echo "  3) Tap Following -> should open /u/<username>/following"
