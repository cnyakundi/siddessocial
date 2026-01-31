#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_973_unblock_typecheck"
ROOT="$(pwd)"

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]]; then
  echo "ERROR: Run from repo root (must contain ./frontend and ./backend)."
  echo "Current: $ROOT"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK"

backup_file () {
  local rel="$1"
  local src="$ROOT/$rel"
  local dst="$ROOT/$BK/$rel"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
  fi
}

echo "== ${SD_ID} =="
echo "Backup: ${BK}"
echo ""

# Back up the files we are touching
backup_file "frontend/src/components/PostCard.tsx"
backup_file "frontend/src/app/siddes-post/[id]/page.tsx"
backup_file "frontend/src/app/u/[username]/page.tsx"

# ------------------------------------------------------------
# 1) Restore PostCard.tsx from the sd_971 backup (your file is currently broken)
# ------------------------------------------------------------
LATEST_BK="$(ls -dt "$ROOT"/.backup_sd_971_post_detail_echo_quote_choice_* 2>/dev/null | head -n 1 || true)"

if [[ -n "${LATEST_BK}" ]] && [[ -f "${LATEST_BK}/frontend/src/components/PostCard.tsx" ]]; then
  cp "${LATEST_BK}/frontend/src/components/PostCard.tsx" "$ROOT/frontend/src/components/PostCard.tsx"
  echo "✅ Restored PostCard.tsx from: ${LATEST_BK}"
else
  echo "⚠️  WARN: Could not find sd_971 PostCard backup. Falling back to git restore."
  git restore "$ROOT/frontend/src/components/PostCard.tsx" 2>/dev/null || git checkout -- "$ROOT/frontend/src/components/PostCard.tsx" || true
fi

# ------------------------------------------------------------
# 2) Fix __sd_read_reply_json_once(res) type error in post detail page
#    Approach: add v2 helper + swap the call site(s) to v2.
# ------------------------------------------------------------
node --input-type=commonjs - <<'NODE'
const fs = require("fs");

const file = "frontend/src/app/siddes-post/[id]/page.tsx";
let s = fs.readFileSync(file, "utf8");
const before = s;

if (!s.includes("__sd_read_reply_json_once")) {
  console.error("sd_973: ERROR: could not find __sd_read_reply_json_once in " + file);
  process.exit(2);
}

// Insert v2 helper once (module-scope, right after 'use client')
if (!s.includes("__sd_read_reply_json_once_v2")) {
  const m = s.match(/["']use client["'];/);
  const insert = `

/**
 * sd_973: reply JSON helper (safe single-consume)
 * - Some flows read reply JSON more than once; Response.json() can only be consumed once.
 * - Cache the promise per Response so subsequent reads reuse the same payload.
 */
const __sd_replyJsonOnceCache_v2 = new WeakMap<Response, Promise<any>>();

async function __sd_read_reply_json_once_v2(res: Response) {
  try {
    if (!res) return null;
    const cached = __sd_replyJsonOnceCache_v2.get(res);
    if (cached) return await cached;
    const p = res.json().catch(() => null);
    __sd_replyJsonOnceCache_v2.set(res, p);
    return await p;
  } catch {
    return null;
  }
}

`;
  if (m && typeof m.index === "number") {
    const idx = m.index + m[0].length;
    s = s.slice(0, idx) + insert + s.slice(idx);
  } else {
    s = insert + s;
  }
}

// Replace the problematic call(s): __sd_read_reply_json_once(<something>) -> v2(<same>)
s = s.replace(/__sd_read_reply_json_once\s*\(\s*([^)]+)\s*\)/g, (full, inner) => {
  // Don't rewrite if it's already v2
  if (full.includes("_v2")) return full;
  return `__sd_read_reply_json_once_v2(${inner.trim()})`;
});

if (s === before) {
  console.error("sd_973: ERROR: no changes made to " + file + " (patterns did not match)");
  process.exit(2);
}

fs.writeFileSync(file, s);
console.log("✅ Patched: " + file);
NODE

# ------------------------------------------------------------
# 3) Fix profile page: publicFollowers/publicFollowing are referenced but not defined
#    Approach: replace them with safe expressions off `user`.
# ------------------------------------------------------------
node --input-type=commonjs - <<'NODE'
const fs = require("fs");

const file = "frontend/src/app/u/[username]/page.tsx";
let s = fs.readFileSync(file, "utf8");
const before = s;

s = s.replace(/publicFollowers=\{publicFollowers\}/g, "publicFollowers={(user as any)?.publicFollowers ?? null}");
s = s.replace(/publicFollowing=\{publicFollowing\}/g, "publicFollowing={(user as any)?.publicFollowing ?? null}");

if (s !== before) {
  fs.writeFileSync(file, s);
  console.log("✅ Patched: " + file);
} else {
  console.log("⚠️  WARN: No changes in " + file + " (maybe already fixed or file drifted).");
}
NODE

echo ""
echo "✅ ${SD_ID} applied."
echo "Backup: ${BK}"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo "  cd .. && bash scripts/run_tests.sh --smoke"
echo ""
echo "Rollback:"
echo "  cp \"$BK/frontend/src/components/PostCard.tsx\" \"frontend/src/components/PostCard.tsx\""
echo "  cp \"$BK/frontend/src/app/siddes-post/[id]/page.tsx\" \"frontend/src/app/siddes-post/[id]/page.tsx\""
echo "  cp \"$BK/frontend/src/app/u/[username]/page.tsx\" \"frontend/src/app/u/[username]/page.tsx\""
