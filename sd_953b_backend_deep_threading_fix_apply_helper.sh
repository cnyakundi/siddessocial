#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_953b_backend_deep_threading_fix"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Bulletproof preconditions
for d in frontend backend scripts; do
  if [[ ! -d "$ROOT/$d" ]]; then
    echo "❌ Run from repo root. Missing ./$d"
    echo "Tip: cd /Users/cn/Downloads/sidesroot"
    exit 1
  fi
done

DB_STORE="backend/siddes_post/store_db.py"
MEM_STORE="backend/siddes_reply/store.py"
STATE="docs/STATE.md"

if [[ ! -f "$DB_STORE" ]]; then
  echo "❌ Missing: $DB_STORE"
  exit 1
fi
if [[ ! -f "$MEM_STORE" ]]; then
  echo "❌ Missing: $MEM_STORE"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required for safe patching."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK"

backup_one () {
  local rel="$1"
  if [[ -f "$rel" ]]; then
    mkdir -p "$BK/$(dirname "$rel")"
    cp -a "$rel" "$BK/$rel"
  fi
}

backup_one "$DB_STORE"
backup_one "$MEM_STORE"
backup_one "$STATE"

echo "✅ Backup: $BK"
echo ""

# Restore the two store files to HEAD so we remove the indentation break
echo "== Safety restore (only these two files) =="
git restore "$DB_STORE" "$MEM_STORE" || true
echo "✅ Restored $DB_STORE and $MEM_STORE from git (HEAD)."
echo ""

node <<'NODE'
const fs = require("fs");

const DB_STORE = "backend/siddes_post/store_db.py";
const MEM_STORE = "backend/siddes_reply/store.py";
const STATE = "docs/STATE.md";

function insertMaxDepthConstant(src) {
  if (/\bMAX_REPLY_DEPTH\s*=\s*\d+/.test(src)) return src;

  const lines = src.split("\n");

  // Find last import line in the top-of-file import block
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(import|from)\s+/.test(lines[i])) lastImport = i;
    else if (lastImport >= 0 && /^\s*$/.test(lines[i])) continue;
    else if (lastImport >= 0) break;
  }

  const insAt = lastImport >= 0 ? lastImport + 1 : 0;
  const block = [
    "",
    "# sd_953: deep reply threading guard (prevents abuse)",
    "MAX_REPLY_DEPTH = 25",
    "",
  ];
  lines.splice(insAt, 0, ...block);
  return lines.join("\n");
}

function patchOneLevelBlock(src, kind) {
  const patterns = [
    /(\s*)# Facebook-style: one nesting level only\s*\n\1if getattr\(parent,\s*"parent_id",\s*None\):\s*\n\1\s*raise ValueError\("parent_too_deep"\)\s*\n\1depth\s*=\s*int\(getattr\(parent,\s*"depth",\s*0\)\s*or\s*0\)\s*\+\s*1\s*\n\1if depth\s*>\s*1:\s*\n\1\s*raise ValueError\("parent_too_deep"\)\s*\n?/m,
    /(\s*)# One nesting level only\s*\n\1if getattr\(parent,\s*"parent_id",\s*None\):\s*\n\1\s*raise ValueError\("parent_too_deep"\)\s*\n\1depth\s*=\s*int\(getattr\(parent,\s*"depth",\s*0\)\s*or\s*0\)\s*\+\s*1\s*\n\1if depth\s*>\s*1:\s*\n\1\s*raise ValueError\("parent_too_deep"\)\s*\n?/m,
  ];

  for (const re of patterns) {
    if (re.test(src)) {
      return src.replace(re, (_m, indent) => (
`${indent}# sd_953: allow deep reply threading (bounded)
${indent}depth = int(getattr(parent, "depth", 0) or 0) + 1
${indent}if depth > MAX_REPLY_DEPTH:
${indent}    raise ValueError("parent_too_deep")
`
      ));
    }
  }

  const loose = /(\s*)depth\s*=\s*int\(getattr\(parent,\s*"depth",\s*0\)\s*or\s*0\)\s*\+\s*1\s*\n\1if depth\s*>\s*1:\s*\n\1\s*raise ValueError\("parent_too_deep"\)\s*\n?/m;
  if (loose.test(src)) {
    return src.replace(loose, (_m, indent) => (
`${indent}# sd_953: allow deep reply threading (bounded)
${indent}depth = int(getattr(parent, "depth", 0) or 0) + 1
${indent}if depth > MAX_REPLY_DEPTH:
${indent}    raise ValueError("parent_too_deep")
`
    ));
  }

  throw new Error(`sd_953b: Could not find one-level depth gate in ${kind}.`);
}

function applyFile(filePath, kind) {
  let s = fs.readFileSync(filePath, "utf8");
  s = insertMaxDepthConstant(s);
  s = patchOneLevelBlock(s, kind);
  fs.writeFileSync(filePath, s, "utf8");
  console.log("PATCHED:", filePath);
}

applyFile(DB_STORE, "DB_STORE");
applyFile(MEM_STORE, "MEM_STORE");

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_953b:** Fix: backend deep reply threading patch (restore + safe MAX_REPLY_DEPTH constant at module scope; no indentation break).";
    let t = fs.readFileSync(STATE, "utf8");
    if (!t.includes(mark)) {
      const line = `- ${mark}\n`;
      if (t.includes("## NEXT overlay")) t = t.replace("## NEXT overlay", "## NEXT overlay\n" + line);
      else t += "\n\n## NEXT overlay\n" + line;
      fs.writeFileSync(STATE, t, "utf8");
      console.log("PATCHED:", STATE);
    }
  }
} catch {}
NODE

echo ""
echo "== Gates =="
./verify_overlays.sh
(
  cd frontend
  npm run typecheck
  npm run build
)
bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
