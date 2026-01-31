#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_974_unblock_typecheck"
find_repo_root() {
  local d
  d="$(pwd)"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "❌ ERROR: run from repo root (must contain frontend/ and backend/)." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_${SD_ID}_${STAMP}"
mkdir -p "$BK"

backup_file () {
  local rel="$1"
  local src="$ROOT/$rel"
  local dst="$BK/$rel"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
  fi
}

echo "== $SD_ID =="
echo "Backup: $BK"
echo ""

backup_file "frontend/src/components/PostCard.tsx"
backup_file "frontend/src/app/siddes-post/[id]/page.tsx"
backup_file "frontend/src/app/u/[username]/page.tsx"

# 1) Restore PostCard.tsx from the backup created by your sd_971 echo/quote helper (pre-patch file)
LATEST_POSTCARD_BK="$(ls -dt "$ROOT"/.backup_sd_971_post_detail_echo_quote_choice_* 2>/dev/null | head -n 1 || true)"
if [ -n "${LATEST_POSTCARD_BK:-}" ] && [ -f "$LATEST_POSTCARD_BK/frontend/src/components/PostCard.tsx" ]; then
  cp "$LATEST_POSTCARD_BK/frontend/src/components/PostCard.tsx" "$ROOT/frontend/src/components/PostCard.tsx"
  echo "✅ Restored PostCard.tsx from: $LATEST_POSTCARD_BK"
else
  echo "⚠️  WARN: Could not find sd_971 PostCard backup. Trying git restore."
  (cd "$ROOT" && git restore frontend/src/components/PostCard.tsx 2>/dev/null) || true
  (cd "$ROOT" && git checkout -- frontend/src/components/PostCard.tsx 2>/dev/null) || true
fi

# 2) Fix __sd_read_reply_json_once signature mismatch by adding a v2 helper + swapping call sites that pass an argument.
node --input-type=commonjs - <<'NODE'
const fs = require("fs");

const file = "frontend/src/app/siddes-post/[id]/page.tsx";
let s = fs.readFileSync(file, "utf8");
const before = s;

function die(msg) {
  console.error("sd_974:", msg);
  process.exit(2);
}

if (!s.includes("__sd_read_reply_json_once")) {
  die("Could not find __sd_read_reply_json_once in " + file);
}

if (!s.includes("__sd_read_reply_json_once_v2")) {
  const useClient = s.match(/["']use client["'];/);
  const insert = `

/**
 * sd_974: reply JSON helper (single-consume safe)
 * Response.json() can only be consumed once.
 * Cache the JSON promise per Response so later reads reuse the same payload.
 */
const __sd_replyJsonOnceCache_v2 = new WeakMap<Response, Promise<any>>();

async function __sd_read_reply_json_once_v2(res: Response) {
  try {
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
  if (useClient && typeof useClient.index === "number") {
    const idx = useClient.index + useClient[0].length;
    s = s.slice(0, idx) + insert + s.slice(idx);
  } else {
    s = insert + s;
  }
}

// Replace only calls that pass an argument (fixes TS2554)
const callRe = /__sd_read_reply_json_once\s*\(\s*([^)]+?)\s*\)/g;
s = s.replace(callRe, (m, inner) => {
  if (m.includes("_v2")) return m;
  // Ignore accidental matches inside function declarations
  if (m.startsWith("function __sd_read_reply_json_once")) return m;
  return `__sd_read_reply_json_once_v2(${inner.trim()})`;
});

if (s === before) die("No changes made to " + file + " (patterns did not match).");

fs.writeFileSync(file, s);
console.log("✅ Patched:", file);
NODE

# 3) Fix /u/[username] page undefined variables by inlining safe reads from `user`
node --input-type=commonjs - <<'NODE'
const fs = require("fs");

const file = "frontend/src/app/u/[username]/page.tsx";
let s = fs.readFileSync(file, "utf8");
const before = s;

s = s.replace(/publicFollowers=\{publicFollowers\}/g, "publicFollowers={(user as any)?.publicFollowers ?? undefined}");
s = s.replace(/publicFollowing=\{publicFollowing\}/g, "publicFollowing={(user as any)?.publicFollowing ?? undefined}");

if (s === before) {
  console.log("⚠️  WARN: No changes in", file, "(maybe already fixed or file drifted).");
} else {
  fs.writeFileSync(file, s);
  console.log("✅ Patched:", file);
}
NODE

echo ""
echo "✅ $SD_ID applied."
echo "Backup: $BK"
echo ""
echo "Next:"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
echo "  cd \"$ROOT/frontend\" && npm run build"
echo "  cd \"$ROOT\" && bash scripts/run_tests.sh --smoke"
echo ""
echo "Rollback:"
echo "  cp \"$BK/frontend/src/components/PostCard.tsx\" \"$ROOT/frontend/src/components/PostCard.tsx\""
echo "  cp \"$BK/frontend/src/app/siddes-post/[id]/page.tsx\" \"$ROOT/frontend/src/app/siddes-post/[id]/page.tsx\""
echo "  cp \"$BK/frontend/src/app/u/[username]/page.tsx\" \"$ROOT/frontend/src/app/u/[username]/page.tsx\""
