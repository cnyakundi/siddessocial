#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_956g_whisper_dedupe_fix"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Preconditions
for d in frontend backend scripts docs; do
  if [[ ! -d "$ROOT/$d" ]]; then
    echo "❌ Run from repo root. Missing ./$d"
    echo "Tip: cd /Users/cn/Downloads/sidesroot"
    exit 1
  fi
done

PAGE="frontend/src/app/siddes-post/[id]/page.tsx"
STATE="docs/STATE.md"

[[ -f "$PAGE" ]] || { echo "❌ Missing: $PAGE"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ node is required."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$PAGE")" "$BK/$(dirname "$STATE")"
cp -a "$PAGE" "$BK/$PAGE"
cp -a "$STATE" "$BK/$STATE" 2>/dev/null || true

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE = "docs/STATE.md";

let s = fs.readFileSync(PAGE, "utf8");
const before = s;

// Remove known duplicate marker lines from earlier attempts (sd_956d) and de-dupe replyScope/isWhisper safely.
let lines = s.split("\n");

let seenReplyScope = false;
let seenIsWhisper = false;

lines = lines.filter((line) => {
  // Remove old duplicate markers
  if (line.includes("sd_956d_reply_scope_state")) return false;
  if (line.includes("sd_956d_whisper_logic")) return false;

  // Keep only one replyScope state declaration
  if (line.includes("const [replyScope, setReplyScope]")) {
    if (seenReplyScope) return false;
    seenReplyScope = true;
    return true;
  }

  // Keep only one isWhisper declaration
  if (line.includes("const isWhisper") && line.includes('replyScope === "friends"') && line.includes('postSide === "public"')) {
    if (seenIsWhisper) return false;
    seenIsWhisper = true;
    return true;
  }

  return true;
});

s = lines.join("\n");

// Quick sanity: if we somehow removed all replyScope declarations, that's bad.
if (!s.includes("const [replyScope, setReplyScope]")) {
  console.log("WARN: replyScope declaration not found after de-dupe. Not writing changes.");
  process.exit(1);
}

if (s !== before) {
  fs.writeFileSync(PAGE, s, "utf8");
  console.log("PATCHED:", PAGE);
} else {
  console.log("NOOP:", PAGE, "(no changes needed)");
}

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_956g:** Fix: remove duplicate whisper state/vars after re-running overlays (dedupe replyScope + isWhisper).";
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
