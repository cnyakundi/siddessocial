#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_953c_backend_deep_threading_safe"
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

echo "== Safety restore (fix indentation break first) =="
git restore "$DB_STORE" "$MEM_STORE" || true
echo "✅ Restored $DB_STORE and $MEM_STORE from git (HEAD)."
echo ""

node <<'NODE'
const fs = require("fs");

const DB_STORE = "backend/siddes_post/store_db.py";
const MEM_STORE = "backend/siddes_reply/store.py";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

function patchDeepThreading(src, kind) {
  let changed = false;

  // 1) Remove the "no replying to replies" cap (parent.parent_id gate)
  const parentGates = [
    /(\n)([ \t]*)if getattr\(parent,\s*["']parent_id["'],\s*None\):\s*\n([ \t]*)raise ValueError\(["']parent_too_deep["']\)\s*\n/g,
    /(\n)([ \t]*)if parent\.parent_id:\s*\n([ \t]*)raise ValueError\(["']parent_too_deep["']\)\s*\n/g,
  ];

  for (const re of parentGates) {
    if (re.test(src)) {
      src = src.replace(re, (_m, nl, indent) => {
        changed = true;
        return `${nl}${indent}# sd_953c: allow replying to replies (removed one-level cap)\n`;
      });
      break;
    }
  }

  // 2) Increase depth limit from 1 -> 25 (keep raise indentation exactly)
  const depthGate = /(\n)([ \t]*)if depth\s*>\s*1:\s*\n([ \t]*)raise ValueError\(["']parent_too_deep["']\)\s*\n/g;
  if (depthGate.test(src)) {
    src = src.replace(depthGate, (_m, nl, indentIf, indentRaise) => {
      changed = true;
      return `${nl}${indentIf}if depth > 25:\n${indentRaise}raise ValueError("parent_too_deep")\n`;
    });
  }

  must(changed, `sd_953c: Could not find expected parent/depth gates in ${kind} (file drifted).`);
  return src;
}

function apply(filePath, kind) {
  let s = fs.readFileSync(filePath, "utf8");
  if (s.includes("\t")) s = s.replace(/\t/g, "    "); // tabs can break python indentation
  const out = patchDeepThreading(s, kind);
  fs.writeFileSync(filePath, out, "utf8");
  console.log("PATCHED:", filePath);
}

apply(DB_STORE, "DB_STORE");
apply(MEM_STORE, "MEM_STORE");

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_953c:** Backend: deep reply threading safe patch (no indentation risk) — remove parent.parent_id gate + set depth limit to 25.";
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
