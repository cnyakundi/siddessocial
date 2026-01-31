#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_960_connections_directional_ui_clean"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK="${ROOT}/.backup_${SD_ID}_${TS}"

if [[ ! -d "${ROOT}/frontend" ]]; then
  echo "ERROR: Run from repo root (expected ./frontend)."
  exit 1
fi

mkdir -p "${BK}"

backup_file() {
  local f="$1"
  if [[ -f "$f" ]]; then
    local dest="${BK}/${f#${ROOT}/}"
    mkdir -p "$(dirname "$dest")"
    cp -p "$f" "$dest"
  fi
}

TARGET="${ROOT}/frontend/src/app/siddes-profile/connections/page.tsx"
backup_file "$TARGET"

python3 - <<'PY'
import pathlib, re, sys

p = pathlib.Path("frontend/src/app/siddes-profile/connections/page.tsx")
if not p.exists():
    print("ERROR: missing", str(p))
    sys.exit(1)

s = p.read_text(encoding="utf-8")
orig = s

# 1) Replace SIDE_BADGE with SIDE_DOT + RelTag (dot-based, no pill clutter)
pat_badge = r"const\s+SIDE_BADGE\s*:\s*Record<\s*SideKey\s*,\s*string\s*>\s*=\s*\{[\s\S]*?\n\};"
replacement = """const SIDE_DOT: Record<SideKey, string> = {
  friends: \"bg-emerald-500\",
  close: \"bg-rose-500\",
  work: \"bg-slate-500\",
};

function RelTag({ side, who }: { side: SideKey; who: string }) {
  const dot = SIDE_DOT[side];
  return (
    <span className=\"inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600\">
      <span className={cn(\"w-1.5 h-1.5 rounded-full\", dot)} aria-hidden=\"true\" />
      <span className=\"text-gray-500\">{who}</span>
      <span className=\"text-gray-300\">→</span>
      <span className=\"text-gray-900\">{SIDE_LABEL[side]}</span>
    </span>
  );
}
"""

s, n = re.subn(pat_badge, replacement, s, count=1)
if n == 0:
    print("WARN: SIDE_BADGE block not found (maybe already applied).")

# 2) Remove the Badge component if it exists
s, _ = re.subn(r"\n\s*function\s+Badge\s*\([^\)]*\)\s*\{[\s\S]*?\n\s*\}\s*\n", "\n", s, count=1)

# 3) Replace any <Badge side={X}>WHO → {SIDE_LABEL[X]}</Badge> with <RelTag side={X} who="WHO" />

badge_pat = re.compile(
    r"<Badge\s+side=\{(?P<side>[^}]+)\}\s*>\s*(?P<who>You|Them|They)\s*→\s*\{SIDE_LABEL\[(?P<label>[^\]]+)\]\}\s*</Badge>",
    flags=re.M,
)

def repl(m: re.Match) -> str:
    side = m.group("side").strip()
    who = m.group("who").strip()
    return f'<RelTag side={{{side}}} who="{who}" />'

s, n3 = badge_pat.subn(repl, s)

# Safety: fail if any <Badge remains
if "<Badge" in s:
    print("ERROR: leftover <Badge> usage still present; aborting to avoid half-state.")
    sys.exit(2)

if "SIDE_BADGE" in s:
    print("ERROR: leftover SIDE_BADGE references still present; aborting.")
    sys.exit(2)

if s == orig:
    print("SKIP: no changes (already clean?)")
    sys.exit(0)

p.write_text(s, encoding="utf-8")
print("OK: patched", str(p))
print("Replaced badge tags:", n3)
PY

echo ""
echo "✅ ${SD_ID} applied."
echo "Backup: ${BK}"
echo ""
echo "Next (VS Code terminal):"
echo "  ./verify_overlays.sh"
echo "  cd frontend && npm run typecheck && npm run build"
echo ""
echo "Smoke test:"
echo "  - Open /siddes-profile/connections"
echo "  - Mutuals rows show tiny dot tags (no pill badges)"
echo "  - Followers/Following rows still show relationship direction"
