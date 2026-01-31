#!/usr/bin/env bash
set -euo pipefail

# sd_943_profile_follow_counts_links_apply_helper.sh
# Goal: Make Public profile Followers/Following stats clickable (open roster pages)

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

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_943_${STAMP}"
mkdir -p "$BK/frontend/src/components"

cp "$ROOT/frontend/src/components/ProfileV2Header.tsx" "$BK/frontend/src/components/ProfileV2Header.tsx"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/ProfileV2Header.tsx")
s = p.read_text(encoding="utf-8")

# 1) Ensure next/link import exists
if 'import Link from "next/link";' not in s:
    if 'import React from "react";' not in s:
        raise SystemExit('Expected: import React from "react"; (file changed?)')
    s = s.replace('import React from "react";', 'import React from "react";\nimport Link from "next/link";', 1)

# 2) Replace Stat() to support optional href
pattern = r"function Stat\([\s\S]*?\n\}\n\nfunction PillsRow"
replacement = """function Stat(props: {
  label: string;
  value: React.ReactNode;
  subtle?: boolean;
  href?: string | null;
  ariaLabel?: string;
}) {
  const { label, value, subtle, href, ariaLabel } = props;

  const inner = (
    <>
      <span className="text-lg font-black text-gray-900 leading-none tabular-nums">{value}</span>
      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-1">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-col",
          "rounded-xl",
          "focus:outline-none focus:ring-2 focus:ring-gray-200",
          "hover:bg-gray-50",
          "cursor-pointer",
          subtle ? "opacity-80 hover:opacity-100" : ""
        )}
        aria-label={ariaLabel || label}
        title={label}
      >
        {inner}
      </Link>
    );
  }

  return <div className={cn("flex flex-col", subtle ? "opacity-80" : "")}>{inner}</div>;
}

function PillsRow"""
new, n = re.subn(pattern, replacement, s, flags=re.DOTALL)
if n != 1:
    raise SystemExit(f"Stat() replace failed; expected 1 match, got {n}")
s = new

# 3) Insert href builders after safeHandle (only once)
needle = '  const safeHandle = (handle || "").trim();'
if needle not in s:
    raise SystemExit("Expected safeHandle line not found (file changed?)")

if "followersHref" not in s and "followingHref" not in s:
    insert = """  const userSlug = safeHandle.replace(/^@/, "").trim().split(/\\s+/)[0] || "";
  const followersHref = userSlug ? `/u/${encodeURIComponent(userSlug)}/followers` : null;
  const followingHref = userSlug ? `/u/${encodeURIComponent(userSlug)}/following` : null;"""
    s = s.replace(needle, needle + "\n" + insert, 1)

# 4) Make Followers/Following Stats clickable inside the stats row
def add_link(label: str, href_var: str, aria: str) -> None:
    global s
    pat = rf'<Stat\s+label="{label}"\s+value=\{{(?P<expr>[\s\S]*?)\}}\s+subtle\s*/>'
    def repl(m):
        expr = m.group("expr")
        return f'<Stat label="{label}" value={{' + expr + f'}} subtle href={{{href_var}}} ariaLabel={{`{aria} ${{safeHandle}}`}} />'
    s2, nn = re.subn(pat, repl, s, count=1, flags=re.DOTALL)
    if nn != 1:
        raise SystemExit(f'Could not patch Stat "{label}" (pattern mismatch).')
    s = s2

add_link("Followers", "followersHref", "View followers of")
add_link("Following", "followingHref", "View following of")

p.write_text(s, encoding="utf-8")
print("OK: ProfileV2Header stats are now clickable")
PY

echo ""
echo "✅ sd_943 applied."
echo "Backups: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Manual QA:"
echo "  1) Open /u/<username> in Public view"
echo "  2) Tap Followers -> /u/<username>/followers"
echo "  3) Tap Following -> /u/<username>/following"
echo ""
echo "Rollback:"
echo "  cp \"$BK/frontend/src/components/ProfileV2Header.tsx\" \"$ROOT/frontend/src/components/ProfileV2Header.tsx\""
