#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_953_backend_deep_threading"
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

node <<'NODE'
const fs = require("fs");

const DB_STORE = "backend/siddes_post/store_db.py";
const MEM_STORE = "backend/siddes_reply/store.py";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

function patchDbStore(src) {
  if (src.includes("sd_953") && src.includes("MAX_REPLY_DEPTH")) return { out: src, changed: false };

  const re = /(\s*)# Facebook-style: one nesting level only\s*\n\1if getattr\(parent,\s*"parent_id",\s*None\):\s*\n\1\s*raise ValueError\("parent_too_deep"\)\s*\n\1depth\s*=\s*int\(getattr\(parent,\s*"depth",\s*0\)\s*or\s*0\)\s*\+\s*1\s*\n\1if depth\s*>\s*1:\s*\n\1\s*raise ValueError\("parent_too_deep"\)\s*/m;

  must(re.test(src), "sd_953: Could not find DbReplyStore one-level depth restriction block in store_db.py");

  const out = src.replace(re, (_m, indent) => (
`${indent}# sd_953: allow deep reply threading (bounded to prevent abuse)
${indent}MAX_REPLY_DEPTH = 25
${indent}depth = int(getattr(parent, "depth", 0) or 0) + 1
${indent}if depth > MAX_REPLY_DEPTH:
${indent}    raise ValueError("parent_too_deep")
`
  ));

  return { out, changed: out !== src };
}

function patchMemStore(src) {
  src = src.replace(/one-level threading/gi, "multi-level threading (bounded)");

  if (src.includes("sd_953") && src.includes("MAX_REPLY_DEPTH")) return { out: src, changed: false };

  const re = /(\s*)# One nesting level only\s*\n\1if getattr\(parent,\s*"parent_id",\s*None\):\s*\n\1\s*raise ValueError\("parent_too_deep"\)\s*\n\1depth\s*=\s*int\(getattr\(parent,\s*"depth",\s*0\)\s*or\s*0\)\s*\+\s*1\s*\n\1if depth\s*>\s*1:\s*\n\1\s*raise ValueError\("parent_too_deep"\)\s*/m;

  must(re.test(src), "sd_953: Could not find ReplyStore one-level depth restriction block in siddes_reply/store.py");

  const out = src.replace(re, (_m, indent) => (
`${indent}# sd_953: allow deep reply threading (bounded to prevent abuse)
${indent}MAX_REPLY_DEPTH = 25
${indent}depth = int(getattr(parent, "depth", 0) or 0) + 1
${indent}if depth > MAX_REPLY_DEPTH:
${indent}    raise ValueError("parent_too_deep")
`
  ));

  return { out, changed: out !== src };
}

let db = fs.readFileSync(DB_STORE, "utf8");
let mem = fs.readFileSync(MEM_STORE, "utf8");

const r1 = patchDbStore(db);
const r2 = patchMemStore(mem);

if (r1.changed) {
  fs.writeFileSync(DB_STORE, r1.out, "utf8");
  console.log("PATCHED:", DB_STORE);
} else {
  console.log("SKIP:", DB_STORE, "(already patched or no change)");
}

if (r2.changed) {
  fs.writeFileSync(MEM_STORE, r2.out, "utf8");
  console.log("PATCHED:", MEM_STORE);
} else {
  console.log("SKIP:", MEM_STORE, "(already patched or no change)");
}

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_953:** Backend: enable deep reply threading (bounded max depth=25) — removes one-level parent_too_deep restriction in DB + memory reply stores.";
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
