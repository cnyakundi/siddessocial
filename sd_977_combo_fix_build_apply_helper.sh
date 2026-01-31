#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_977_combo_fix_build"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$ROOT/frontend" ]; then
  echo "ERROR: Run this from your repo root (missing: $ROOT/frontend)."
  exit 1
fi

TS="$(date +"%Y%m%d_%H%M%S")"
BK="$ROOT/.backup_${SD_ID}_${TS}"
mkdir -p "$BK"

backup_file () {
  local rel="$1"
  if [ -f "$ROOT/$rel" ]; then
    mkdir -p "$BK/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BK/$rel"
  fi
}

echo "== $SD_ID =="
echo "Root: $ROOT"
echo "Backup: $BK"
echo ""

# --- Backups (defense in depth) ---
backup_file "frontend/src/components/AppTopBar.tsx"
backup_file "frontend/src/app/u/[username]/page.tsx"
backup_file "frontend/src/components/CircleFilterBar.tsx"
backup_file "frontend/src/app/siddes-profile/connections/page.tsx"
backup_file "frontend/src/components/NotificationsView.tsx"
backup_file "frontend/src/components/NotificationsDrawer.tsx"

# --- 1) FIX: AppTopBar syntax corruption (restore from last known clean commit) ---
APP_TOPBAR="frontend/src/components/AppTopBar.tsx"

if [ -f "$ROOT/$APP_TOPBAR" ]; then
  # This exact substring is what caused TS parse errors in your logs.
  if grep -q 'process\.env\.NODE_ENV' "$ROOT/$APP_TOPBAR" && grep -q 'advanced' "$ROOT/$APP_TOPBAR"; then
    echo "== Fix: AppTopBar (restore pre-advanced-gate version) =="

    # Ensure origin refs exist (safe even if offline)
    git fetch origin main --quiet 2>/dev/null || true

    GOOD=""
    for c in $(git rev-list -n 250 HEAD); do
      if git show "$c:$APP_TOPBAR" > /tmp/sd_apptopbar 2>/dev/null; then
        # Pick the most recent version that doesn't contain the fragile gate.
        if ! grep -q 'process\.env\.NODE_ENV.*advanced' /tmp/sd_apptopbar; then
          GOOD="$c"
          break
        fi
      fi
    done

    if [ -z "$GOOD" ]; then
      echo "ERROR: Could not auto-find a clean AppTopBar in recent history."
      echo "Restore manually from backup:"
      echo "  cp \"$BK/$APP_TOPBAR\" \"$ROOT/$APP_TOPBAR\""
      exit 1
    fi

    git show "$GOOD:$APP_TOPBAR" > "$ROOT/$APP_TOPBAR"
    echo "OK: Restored $APP_TOPBAR from commit $GOOD"
    echo ""
  fi
fi

# --- 2) FIX: /u/[username] publicFollowers/publicFollowing redeclare (state vs server const) ---
PROFILE_PAGE="frontend/src/app/u/[username]/page.tsx"

if [ -f "$ROOT/$PROFILE_PAGE" ]; then
  if grep -q 'const \[publicFollowers, setPublicFollowers\]' "$ROOT/$PROFILE_PAGE" && grep -q 'const publicFollowers = typeof' "$ROOT/$PROFILE_PAGE"; then
    echo "== Fix: Profile follow counts redeclare (remove duplicate server consts) =="
    python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/u/[username]/page.tsx")
s = p.read_text(encoding="utf-8")

# Remove duplicate server-derived consts that conflict with state vars.
s2 = re.sub(r"\n\s*const publicFollowers\s*=\s*typeof[^\n]*\n", "\n", s)
s2 = re.sub(r"\n\s*const publicFollowing\s*=\s*typeof[^\n]*\n", "\n", s2)

if s2 != s:
    p.write_text(s2, encoding="utf-8")
    print("OK: Removed duplicate const publicFollowers/publicFollowing.")
else:
    print("OK: No duplicate consts found.")
PY
    echo ""
  fi
fi

# --- 3) FIX: CircleFilterBar theme shape drift (primaryBg -> bg) ---
CIRCLE_FILTER="frontend/src/components/CircleFilterBar.tsx"

if [ -f "$ROOT/$CIRCLE_FILTER" ]; then
  if grep -q 'primaryBg' "$ROOT/$CIRCLE_FILTER"; then
    echo "== Fix: CircleFilterBar (primaryBg -> bg) =="
    python3 - <<'PY'
from pathlib import Path
p = Path("frontend/src/components/CircleFilterBar.tsx")
s = p.read_text(encoding="utf-8")

# Handle both optional chaining and direct access.
s2 = s.replace("t?.primaryBg", "t?.bg").replace("t.primaryBg", "t.bg")

if s2 != s:
    p.write_text(s2, encoding="utf-8")
    print("OK: Replaced primaryBg -> bg")
else:
    print("OK: No primaryBg reference found")
PY
    echo ""
  fi
fi

# --- 4) FIX: Connections page RelTag missing (only if referenced + missing definition) ---
CONNECTIONS_PAGE="frontend/src/app/siddes-profile/connections/page.tsx"

if [ -f "$ROOT/$CONNECTIONS_PAGE" ]; then
  if grep -q '<RelTag' "$ROOT/$CONNECTIONS_PAGE" && ! grep -q 'function RelTag' "$ROOT/$CONNECTIONS_PAGE" && ! grep -q 'const RelTag' "$ROOT/$CONNECTIONS_PAGE"; then
    echo "== Fix: Connections RelTag (inject minimal helper) =="
    python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = p.read_text(encoding="utf-8")

# Insert after cn() helper if present, else near top.
m = re.search(r"\nfunction cn\([^)]*\)\s*\{.*?\n\}\n", s, re.S)
ins = m.end() if m else 0

helper = '''
function RelTag({ side, who }: { side: any; who: string }) {
  const s = String(side || "").toLowerCase();
  const tone =
    s === "friends"
      ? { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" }
      : s === "close"
        ? { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" }
        : s === "work"
          ? { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500" }
          : { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", dot: "bg-gray-400" };

  return (
    <span className={"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest " + tone.bg + " " + tone.text + " " + tone.border}>
      <span className={"w-1.5 h-1.5 rounded-full " + tone.dot} aria-hidden />
      {who}
    </span>
  );
}
'''

if "function RelTag(" in s or "const RelTag" in s:
    print("OK: RelTag already present")
else:
    s2 = s[:ins] + "\n" + helper + "\n" + s[ins:]
    p.write_text(s2, encoding="utf-8")
    print("OK: Injected RelTag helper")
PY
    echo ""
  fi
fi

echo "== Gates =="
"$ROOT/verify_overlays.sh"
echo ""

echo "Frontend typecheck..."
( cd "$ROOT/frontend" && npm run typecheck )
echo ""

echo "Frontend build..."
( cd "$ROOT/frontend" && npm run build )
echo ""

echo "Smoke..."
( cd "$ROOT" && bash scripts/run_tests.sh --smoke )
echo ""

echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Next (optional):"
echo "  git status"
echo "  git add . && git commit -m \"$SD_ID\" && git push"
