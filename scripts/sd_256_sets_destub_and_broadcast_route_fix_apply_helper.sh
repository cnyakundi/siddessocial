#!/usr/bin/env bash
set -euo pipefail

# sd_256_sets_destub_and_broadcast_route_fix_apply_helper.sh
#
# Batch-safe fixes:
# 1) Fix /api/broadcasts route compile bug (proxyPost missing csrf/origin/referer/reqId defs).
# 2) Remove sd_viewer cookie gating + cookie-instruction banners from Circles pages (list + detail).
# 3) Remove always-on "Dev stub requires sd_viewer=me" copy from InviteActionSheet.
# 4) Remove unused/duplicated inviteSuggestions block in Circle detail page (extra requests + lint risk).
#
# Run from repo root (must contain ./frontend and ./backend).

ROOT_DIR="$(pwd)"
if [[ ! -d "${ROOT_DIR}/frontend" ]] || [[ ! -d "${ROOT_DIR}/backend" ]]; then
  echo "[sd_256] ERROR: Run from repo root (must contain ./frontend and ./backend)."
  echo "[sd_256] Current dir: ${ROOT_DIR}"
  exit 1
fi

need() { [[ -f "$1" ]] || { echo "[sd_256] ERROR: Missing file: $1"; exit 1; }; }

FILES=(
  "frontend/src/app/api/broadcasts/route.ts"
  "frontend/src/app/siddes-circles/page.tsx"
  "frontend/src/app/siddes-circles/[id]/page.tsx"
  "frontend/src/components/Invites/InviteActionSheet.tsx"
)

for f in "${FILES[@]}"; do need "$f"; done

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".backup_sd_256_sets_destub_${STAMP}"
mkdir -p "$BACKUP_DIR"

backup() {
  local f="$1"
  mkdir -p "$BACKUP_DIR/$(dirname "$f")"
  cp -p "$f" "$BACKUP_DIR/$f"
}
for f in "${FILES[@]}"; do backup "$f"; done
echo "[sd_256] Backup saved to: $BACKUP_DIR"

PYBIN="python3"
command -v python3 >/dev/null 2>&1 || PYBIN="python"

"$PYBIN" - <<'PY'
import re
from pathlib import Path

def read(p: str) -> str:
    return Path(p).read_text(encoding="utf-8")

def write(p: str, s: str) -> None:
    Path(p).write_text(s, encoding="utf-8")

def sub_all(path: str, pattern: str, repl, flags: int = 0, label: str = "") -> int:
    s = read(path)
    s2, n = re.subn(pattern, repl, s, flags=flags)
    if n:
        write(path, s2)
        print(f"[sd_256] Patched: {path}" + (f" ({label}, {n}x)" if label else f" ({n}x)"))
    return n

def sub_once(path: str, pattern: str, repl, flags: int = 0, label: str = "") -> bool:
    s = read(path)
    s2, n = re.subn(pattern, repl, s, count=1, flags=flags)
    if n:
        write(path, s2)
        print(f"[sd_256] Patched: {path}" + (f" ({label})" if label else ""))
        return True
    return False

# 1) broadcasts route: ensure proxyPost defines csrf/origin/referer/reqId
BR = "frontend/src/app/api/broadcasts/route.ts"
s = read(BR)

# Only patch if proxyPost exists AND does not already define csrf in proxyPost
if "async function proxyPost" in s:
    post_part = s.split("async function proxyPost", 1)[-1]
    if 'const csrf = req.headers.get("x-csrftoken")' not in post_part:
        s2 = s.replace(
            "  const body = await req.json().catch(() => ({}));\n\n  const res = await fetch",
            "  const body = await req.json().catch(() => ({}));\n\n"
            "  // sd_256: forward csrf + origin + request id\n"
            "  const csrf = req.headers.get(\"x-csrftoken\") || \"\";\n"
            "  const origin = req.headers.get(\"origin\") || \"\";\n"
            "  const referer = req.headers.get(\"referer\") || \"\";\n"
            "  const reqId = req.headers.get(\"x-request-id\") || \"\";\n\n"
            "  const res = await fetch",
        )
        if s2 != s:
            write(BR, s2)
            print(f"[sd_256] Patched: {BR} (proxyPost header vars)")
        else:
            print(f"[sd_256] WARN: {BR} proxyPost patch pattern mismatch (please inspect manually)")
    else:
        print(f"[sd_256] NOTE: {BR} already has proxyPost header vars")
else:
    print(f"[sd_256] WARN: {BR} missing proxyPost (unexpected)")

# 2) Circles list page: remove sd_viewer gating
SETS_LIST = "frontend/src/app/siddes-circles/page.tsx"

sub_all(SETS_LIST,
        r'^\s*import\s+\{\s*getStubViewerCookie\s*,\s*isStubMe\s*\}\s+from\s+"@/src/lib/stubViewerClient";\s*\n',
        "",
        flags=re.M,
        label="drop stubViewerClient import")

sub_all(SETS_LIST,
        r'^\s*import\s+\{\s*CirclesJoinedPill\s*\}\s+from\s+"@/src/components/CirclesJoinedBanner";\s*\n',
        "",
        flags=re.M,
        label="drop CirclesJoinedPill import")

sub_all(SETS_LIST,
        r'^\s*const\s+providerName\s*=\s*setsProvider\.name;\s*\n',
        "",
        flags=re.M,
        label="drop providerName")

# Replace viewer/canWrite/readOnly block with session-truth canWrite
sub_once(SETS_LIST,
         r'\n\s*const\s*\[viewer\s*,\s*setViewer\]\s*=\s*useState<[^>]*>\([^;]*\);\s*\n\s*useEffect\([\s\S]*?\);\s*\n\s*\n\s*const\s+canWrite\s*=\s*[^;]*;\s*\n\s*const\s+readOnly\s*=\s*[^;]*;\s*\n',
         "\n\n  // sd_256: Circles UI is session-auth only (no viewer cookie gating).\n  const canWrite = true;\n\n",
         flags=re.S,
         label="remove viewer gating block")

# Remove showViewerHint memo + render
sub_all(SETS_LIST,
        r'\n\s*const\s+showViewerHint\s*=\s*React\.useMemo\([\s\S]*?\);\s*\n',
        "\n",
        flags=re.S,
        label="remove showViewerHint memo")

sub_all(SETS_LIST,
        r'\n\s*\{showViewerHint\s*\?\s*\([\s\S]*?\)\s*:\s*null\}\s*\n',
        "\n",
        flags=re.S,
        label="remove showViewerHint render")

# Remove readOnly banner render
sub_all(SETS_LIST,
        r'\n\s*\{readOnly\s*\?\s*\([\s\S]*?\)\s*:\s*null\}\s*\n',
        "\n",
        flags=re.S,
        label="remove readOnly render")

# Remove create() sd_viewer error block
sub_all(SETS_LIST,
        r'\n\s*if\s*\(!canWrite\)\s*\{\s*\n\s*const\s+msg\s*=\s*"Create restricted \(stub\): switch sd_viewer=me";[\s\S]*?\n\s*\}\s*\n',
        "\n",
        flags=re.S,
        label="remove create sd_viewer check")

# 3) Circles detail page: remove sd_viewer gating + remove unused inviteSuggestions block
SET_DETAIL = "frontend/src/app/siddes-circles/[id]/page.tsx"

sub_all(SET_DETAIL,
        r'^\s*import\s+\{\s*CirclesJoinedBanner\s*,\s*CirclesJoinedPill\s*\}\s+from\s+"@/src/components/CirclesJoinedBanner";\s*\n',
        "",
        flags=re.M,
        label="drop CirclesJoinedBanner import")

sub_all(SET_DETAIL,
        r'^\s*import\s+\{\s*getStubViewerCookie\s*,\s*isStubMe\s*\}\s+from\s+"@/src/lib/stubViewerClient";\s*\n',
        "",
        flags=re.M,
        label="drop stubViewerClient import")

sub_all(SET_DETAIL,
        r'^\s*const\s+providerName\s*=\s*setsProvider\.name;\s*\n',
        "",
        flags=re.M,
        label="drop providerName")

# Replace viewer/canWrite/readOnly block
sub_once(SET_DETAIL,
         r'\n\s*const\s*\[viewer\s*,\s*setViewer\]\s*=\s*useState<[^>]*>\(\(\)\s*=>\s*getStubViewerCookie\(\)\s*\|\|\s*null\);\s*\n\s*useEffect\([\s\S]*?\);\s*\n\s*\n\s*const\s+canWrite\s*=\s*[^;]*;\s*\n\s*const\s+readOnly\s*=\s*[^;]*;\s*\n',
         "\n\n  // sd_256: Circles UI is session-auth only (no viewer cookie gating).\n  const canWrite = true;\n\n",
         flags=re.S,
         label="remove viewer gating block")

# Remove showViewerHint memo + render
sub_all(SET_DETAIL,
        r'\n\s*const\s+showViewerHint\s*=\s*React\.useMemo\([\s\S]*?\);\s*\n',
        "\n",
        flags=re.S,
        label="remove showViewerHint memo")

sub_all(SET_DETAIL,
        r'\n\s*\{showViewerHint\s*\?\s*\([\s\S]*?\)\s*:\s*null\}\s*\n',
        "\n",
        flags=re.S,
        label="remove showViewerHint render")

# Remove readOnly fragment + pill usage if present
sub_all(SET_DETAIL,
        r'\n\s*\{readOnly\s*\?\s*\(\s*<>[\s\S]*?</>\s*\)\s*:\s*null\}\s*\n',
        "\n",
        flags=re.S,
        label="remove readOnly fragment")

sub_all(SET_DETAIL,
        r'\{readOnly\s*\?\s*<CirclesJoinedPill\s*/>\s*:\s*null\}',
        "",
        flags=re.S,
        label="remove readOnly pill")

# Remove sd_viewer-specific save() guard (server enforces)
sub_all(SET_DETAIL,
        r'\n\s*if\s*\(!canWrite\)\s*\{\s*\n\s*setErr\("Read-only: switch sd_viewer=me to edit this Circle\."\);\s*\n\s*return;\s*\n\s*\}\s*\n',
        "\n",
        flags=re.S,
        label="remove save sd_viewer check")

# Remove unused inviteSuggestions block (and its duplicated effect) between sd_181m and sd_181h
sub_all(SET_DETAIL,
        r'\n\s*// sd_181m:[\s\S]*?(?=\n\s*// sd_181h:)',
        "\n",
        flags=re.S,
        label="remove unused inviteSuggestions block")

# 4) InviteActionSheet: replace dev-stub note
INV_SHEET = "frontend/src/components/Invites/InviteActionSheet.tsx"
sub_all(INV_SHEET,
        r'<div className="text-\[11px\] text-gray-400 mt-3">\s*\n\s*Dev stub: invite creation requires <span className="font-mono">sd_viewer=me</span> when using backend_stub\.\s*\n\s*</div>',
        '<div className="text-[11px] text-gray-400 mt-3">Invites are enforced server-side. If you do not have permission, you will see an error.</div>',
        flags=re.S,
        label="replace dev-stub note")

# Minimal post-check: cookie-instruction strings should be gone from Circles pages
for p in [SETS_LIST, SET_DETAIL]:
    s = read(p)
    if 'document.cookie = "sd_viewer=me' in s or "sd_viewer is missing" in s:
        print(f"[sd_256] WARN: {p} still contains cookie-instruction text (please inspect manually).")

PY

echo ""
echo "[sd_256] DONE."
echo ""
echo "Stop/Go gate:"
echo "  npm -C frontend run lint"
echo ""
echo "Quick verification:"
echo "  grep -R -n 'document.cookie = \"sd_viewer=me' frontend/src/app/siddes-circles || true"
echo "  grep -R -n 'sd_viewer is missing' frontend/src/app/siddes-circles || true"
echo "  node -c frontend/src/app/api/broadcasts/route.ts 2>/dev/null || true"
echo ""
echo "Rollback:"
echo "  cp -R \"${BACKUP_DIR}\"/* ."
