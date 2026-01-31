#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

need_file () {
  local rel="$1"
  if [[ ! -f "$ROOT/$rel" ]]; then
    echo "❌ Missing: $rel"
    echo "Run this from your repo root (the folder that contains ./frontend and ./backend)."
    exit 1
  fi
}

need_file "frontend/src/components/ProfileV2Header.tsx"
need_file "frontend/src/app/u/[username]/page.tsx"

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_943b_${STAMP}"
mkdir -p "$BK/frontend/src/components" "$BK/frontend/src/app/u/[username]"

cp "$ROOT/frontend/src/components/ProfileV2Header.tsx" "$BK/frontend/src/components/ProfileV2Header.tsx"
cp "$ROOT/frontend/src/app/u/[username]/page.tsx" "$BK/frontend/src/app/u/[username]/page.tsx"

python3 - <<'PY'
from pathlib import Path
import re

def patch_profile_header():
    p = Path("frontend/src/components/ProfileV2Header.tsx")
    t = p.read_text(encoding="utf-8")

    # Add Next Link import (for smoother client navigation than raw <a>)
    if 'import Link from "next/link";' not in t:
        if 'import React from "react";' not in t:
            raise SystemExit("ProfileV2Header.tsx: expected React import not found.")
        t = t.replace('import React from "react";', 'import React from "react";\nimport Link from "next/link";', 1)

    # Use Link instead of raw anchor when href is present
    t = t.replace('const Wrapper: any = href && !locked ? "a" : "div";', 'const Wrapper: any = href && !locked ? Link : "div";')

    # Add a11y label/title for the link wrapper
    old = 'const wrapperProps: any = href && !locked ? { href } : {};'
    if old in t:
        t = t.replace(
            old,
            'const wrapperProps: any = href && !locked ? { href, "aria-label": `Open ${label}`, title: `Open ${label}` } : {};',
            1,
        )

    # Rename labels to match standard mental model (Twitter-like)
    # (Values already come from publicFollowers/publicFollowing)
    t = t.replace('label="Siders"', 'label="Followers"', 1)
    t = t.replace('label="Side With"', 'label="Following"', 1)

    p.write_text(t, encoding="utf-8")

def patch_profile_page():
    p = Path("frontend/src/app/u/[username]/page.tsx")
    t = p.read_text(encoding="utf-8")

    # Insert publicFollowers/publicFollowing vars after postsCount
    if "const publicFollowers" not in t:
        m = re.search(r'^\s*const postsCount\s*=.*?;\s*$', t, flags=re.M)
        if not m:
            raise SystemExit("page.tsx: could not find postsCount line to insert after.")
        insert = (
            "\n\n"
            "  const publicFollowers = typeof (data as any)?.publicFollowers === \"number\" ? (data as any).publicFollowers : null;\n"
            "  const publicFollowing = typeof (data as any)?.publicFollowing === \"number\" ? (data as any).publicFollowing : null;\n"
        )
        t = t[:m.end()] + insert + t[m.end():]

    # Pass counts into ProfileV2Header call
    if "publicFollowers={publicFollowers}" not in t:
        idx = t.find("<ProfileV2Header")
        if idx == -1:
            raise SystemExit("page.tsx: could not find <ProfileV2Header")
        needle = "postsCount={postsCount}"
        pos = t.find(needle, idx)
        if pos == -1:
            raise SystemExit("page.tsx: could not find postsCount prop inside <ProfileV2Header ... />")
        t = t.replace(
            needle,
            needle + "\n                publicFollowers={publicFollowers}\n                publicFollowing={publicFollowing}",
            1,
        )

    p.write_text(t, encoding="utf-8")

patch_profile_header()
patch_profile_page()
print("OK: wired publicFollowers/publicFollowing + clickable roster links")
PY

echo ""
echo "✅ sd_943b applied."
echo "Backups: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Manual QA:"
echo "  1) Open /u/<username> (Public tab)"
echo "  2) Tap Followers -> /u/<username>/followers"
echo "  3) Tap Following -> /u/<username>/following"
echo ""
echo "Rollback:"
echo "  cp \"$BK/frontend/src/components/ProfileV2Header.tsx\" \"$ROOT/frontend/src/components/ProfileV2Header.tsx\""
echo "  cp \"$BK/frontend/src/app/u/[username]/page.tsx\" \"$ROOT/frontend/src/app/u/[username]/page.tsx\""
