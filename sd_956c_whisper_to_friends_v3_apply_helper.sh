#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_956c_whisper_to_friends_v3"
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

PAGE="frontend/src/app/siddes-post/[id]/page.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$PAGE" ]]; then
  echo "❌ Missing: $PAGE"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required for safe patching."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$PAGE")"
cp -a "$PAGE" "$BK/$PAGE"
if [[ -f "$STATE" ]]; then
  mkdir -p "$BK/$(dirname "$STATE")"
  cp -a "$STATE" "$BK/$STATE"
fi

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

function scanStatementEnd(src, startIdx) {
  let paren = 0, brace = 0, angle = 0;
  let inS=false, inD=false, inB=false, inLine=false, inBlock=false;
  let esc=false;

  for (let i = startIdx; i < src.length; i++) {
    const c = src[i], n = src[i+1];

    if (inLine) { if (c === "\n") inLine=false; continue; }
    if (inBlock) { if (c==="*" && n==="/") { inBlock=false; i++; } continue; }

    if (inS) { if (!esc && c=="'") inS=false; esc = (!esc && c==="\\"); continue; }
    if (inD) { if (!esc && c=='"') inD=false; esc = (!esc && c==="\\"); continue; }
    if (inB) { if (!esc && c=="`") inB=false; esc = (!esc && c==="\\"); continue; }

    if (c==="/" && n==="/") { inLine=true; i++; continue; }
    if (c==="/" && n==="*") { inBlock=true; i++; continue; }
    if (c=="'") { inS=true; esc=false; continue; }
    if (c=='"') { inD=true; esc=false; continue; }
    if (c=="`") { inB=true; esc=false; continue; }

    if (c==="(") paren++;
    if (c===")") paren = Math.max(0, paren-1);
    if (c==="{") brace++;
    if (c==="}") brace = Math.max(0, brace-1);

    // crude generic angle tracking for useState<...>(...)
    if (c==="<") angle++;
    if (c===">") angle = Math.max(0, angle-1);

    if (c===";" && paren===0 && brace===0 && angle===0) return i;
  }
  return -1;
}

function insertReplyScopeState(src) {
  const MARK_STATE = "sd_956c_reply_scope_state";
  if (src.includes(MARK_STATE)) return src;

  // Preferred: insert after replyText state line
  const reReplyText = /^(\s*const\s*\[\s*replyText\s*,\s*setReplyText\s*\]\s*=\s*useState[^\n]*;?\s*)$/m;
  const m = src.match(reReplyText);
  if (m && m[1]) {
    const indent = (m[1].match(/^\s*/) || [""])[0];
    const insert = `${m[1]}\n${indent}const [replyScope, setReplyScope] = useState<"thread" | "friends">("thread"); // ${MARK_STATE}`;
    return src.replace(m[1], insert);
  }

  // Fallback: insert after replyTo useState statement (handles multiline type)
  const reReplyToStart = /const\s*\[\s*replyTo\s*,\s*setReplyTo\s*\]\s*=\s*useState/m;
  const mm = reReplyToStart.exec(src);
  must(mm, "sd_956c: could not find replyText state OR replyTo useState block to anchor replyScope insertion.");

  const stmtStart = mm.index;
  const stmtEnd = scanStatementEnd(src, stmtStart);
  must(stmtEnd !== -1, "sd_956c: could not locate end of replyTo useState statement (semicolon).");

  const lineStart = src.lastIndexOf("\n", stmtStart);
  const indent = (lineStart === -1) ? "" : (src.slice(lineStart + 1, stmtStart).match(/^\s*/)?.[0] || "");

  const insertLine = `\n${indent}const [replyScope, setReplyScope] = useState<"thread" | "friends">("thread"); // ${MARK_STATE}\n`;
  return src.slice(0, stmtEnd + 1) + insertLine + src.slice(stmtEnd + 1);
}

function findSendReplyNowUseCallbackRange(src) {
  const needle = "const sendReplyNow = useCallback(";
  const start = src.indexOf(needle);
  if (start < 0) return null;
  const openParen = src.indexOf("(", start);
  if (openParen < 0) return null;

  let depth = 0;
  let inS=false, inD=false, inB=false, inLine=false, inBlock=false;
  let esc=false;

  for (let i = openParen; i < src.length; i++) {
    const c = src[i], n = src[i+1];

    if (inLine) { if (c === "\n") inLine=false; continue; }
    if (inBlock) { if (c==="*" && n==="/") { inBlock=false; i++; } continue; }

    if (inS) { if (!esc && c=="'") inS=false; esc = (!esc && c==="\\"); continue; }
    if (inD) { if (!esc && c=='"') inD=false; esc = (!esc && c==="\\"); continue; }
    if (inB) { if (!esc && c=="`") inB=false; esc = (!esc && c==="\\"); continue; }

    if (c==="/" && n==="/") { inLine=true; i++; continue; }
    if (c==="/" && n==="*") { inBlock=true; i++; continue; }
    if (c=="'") { inS=true; esc=false; continue; }
    if (c=='"') { inD=true; esc=false; continue; }
    if (c=="`") { inB=true; esc=false; continue; }

    if (c==="(") depth++;
    if (c===")") {
      depth--;
      if (depth===0) return [start, i];
    }
  }
  return null;
}

let s = fs.readFileSync(PAGE, "utf8");

// Formatting: newline after dynamic export
s = s.replace(/export const dynamic = "force-dynamic";\s*import\s+/m, `export const dynamic = "force-dynamic";\n\nimport `);

// 1) replyScope state
s = insertReplyScopeState(s);

// 2) UI toggle
const MARK_UI = "sd_956c_whisper_toggle_ui";
if (!s.includes(MARK_UI)) {
  const needle = 'data-testid="thread-inline-composer"';
  const idx = s.indexOf(needle);
  must(idx >= 0, "sd_956c: could not find thread-inline-composer block to insert whisper toggle UI.");

  const tagEnd = s.indexOf(">", idx);
  must(tagEnd > 0, "sd_956c: could not find end of thread-inline-composer opening tag.");

  const lineStart = s.lastIndexOf("\n", tagEnd);
  const indent = (lineStart === -1) ? "                " : (s.slice(lineStart + 1, tagEnd + 1).match(/^\s*/)?.[0] || "                ");

  const uiLines = [
    "",
    `${indent}{/* ${MARK_UI}: Public-only whisper toggle */}`,
    `${indent}{found.side === "public" ? (`,
    `${indent}  <div className="mb-2 flex items-center justify-between gap-3">`,
    `${indent}    <button`,
    `${indent}      type="button"`,
    `${indent}      onClick={() => setReplyScope((cur) => (cur === "thread" ? "friends" : "thread"))}`,
    `${indent}      className={cn(`,
    `${indent}        "px-3 py-1.5 rounded-full border text-[11px] font-extrabold",`,
    `${indent}        replyScope === "friends"`,
    `${indent}          ? "bg-emerald-50 border-emerald-200 text-emerald-800"`,
    `${indent}          : "bg-blue-50 border-blue-200 text-blue-800"`,
    `${indent}      )}`,
    `${indent}      title="Toggle reply scope"`,
    `${indent}    >`,
    `${indent}      {replyScope === "friends" ? "Whisper to Friends" : "Reply to Public"}`,
    `${indent}    </button>`,
    `${indent}    <div className="text-[11px] font-bold text-gray-500 truncate">`,
    `${indent}      {replyScope === "friends" ? "Friends only" : "Public thread"}`,
    `${indent}    </div>`,
    `${indent}  </div>`,
    `${indent}) : null}`,
    ""
  ];

  const ui = uiLines.join("\n");
  s = s.slice(0, tagEnd + 1) + ui + s.slice(tagEnd + 1);
}

// 3) Whisper logic inside sendReplyNow
const MARK_LOGIC = "sd_956c_whisper_logic";
if (!s.includes(MARK_LOGIC)) {
  const range = findSendReplyNowUseCallbackRange(s);
  must(range, "sd_956c: could not locate const sendReplyNow = useCallback(...).");
  const [start, endParen] = range;
  let block = s.slice(start, endParen + 1);

  // Ensure replyScope in deps
  const depsStart = block.lastIndexOf("[");
  const depsEnd = block.lastIndexOf("]");
  must(depsStart >= 0 && depsEnd > depsStart, "sd_956c: could not locate dependency array in sendReplyNow.");
  const depsInner = block.slice(depsStart + 1, depsEnd);
  if (!/\breplyScope\b/.test(depsInner)) {
    const innerTrim = depsInner.trim();
    const depsNew = innerTrim ? (innerTrim + ", replyScope") : "replyScope";
    block = block.slice(0, depsStart + 1) + depsNew + block.slice(depsEnd);
  }

  // Add isWhisper after const t=...trim()
  if (!block.includes("const isWhisper")) {
    const tRe = /const\s+t\s*=\s*String\([^)]*\)\.trim\(\)\s*;?/m;
    const mT = block.match(tRe);
    must(mT, "sd_956c: could not find const t = String(...).trim() in sendReplyNow.");
    block = block.replace(mT[0], mT[0] + `\n    const isWhisper = replyScope === "friends" && found.side === "public"; // ${MARK_LOGIC}`);
  }

  const fetchNeedle = "fetch(`/api/post/${encodeURIComponent(found.post.id)}/reply`";
  const idxFetch = block.indexOf(fetchNeedle);
  must(idxFetch >= 0, "sd_956c: could not find /reply fetch in sendReplyNow to insert whisper branch.");

  const ls = block.lastIndexOf("\n", idxFetch);
  const indent = (ls === -1) ? "    " : (block.slice(ls + 1, idxFetch).match(/^\s*/)?.[0] || "    ");

  const w = [
    "",
    `${indent}// ${MARK_LOGIC}: whisper to Friends = quote-echo into Friends side (public original)`,
    `${indent}if (isWhisper) {`,
    `${indent}  const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;`,
    `${indent}  if (!onlineNow) {`,
    `${indent}    setReplyError({ kind: "network", message: "Whisper needs internet — try again when online." });`,
    `${indent}    setReplyBusy(false);`,
    `${indent}    return;`,
    `${indent}  }`,
    "",
    `${indent}  try {`,
    `${indent}    const res = await fetch(\`/api/post/\${encodeURIComponent(found.post.id)}/quote\`, {`,
    `${indent}      method: "POST",`,
    `${indent}      headers: { "content-type": "application/json" },`,
    `${indent}      body: JSON.stringify({`,
    `${indent}        text: t,`,
    `${indent}        side: "friends",`,
    `${indent}        client_key: \`whisper_\${Date.now().toString(36)}\`,`,
    `${indent}      }),`,
    `${indent}    });`,
    "",
    `${indent}    const j = await res.json().catch(() => null);`,
    `${indent}    if (res.ok) {`,
    `${indent}      setReplyText("");`,
    `${indent}      setReplyTo(null);`,
    `${indent}      setReplyScope("thread");`,
    `${indent}      setReplyBusy(false);`,
    `${indent}      toast.success("Whispered to Friends.");`,
    `${indent}      return;`,
    `${indent}    }`,
    "",
    `${indent}    const code = j && typeof j.error === "string" ? String(j.error) : "request_failed";`,
    `${indent}    if (res.status === 400) {`,
    `${indent}      if (code === "too_long" && j && typeof j.max === "number") {`,
    `${indent}        setReplyError({ kind: "validation", message: \`Too long. Max \${j.max} characters.\` });`,
    `${indent}      } else if (code === "empty_text") {`,
    `${indent}        setReplyError({ kind: "validation", message: "Write something first." });`,
    `${indent}      } else {`,
    `${indent}        setReplyError({ kind: "validation", message: "Couldn’t whisper — check your text." });`,
    `${indent}      }`,
    `${indent}      setReplyBusy(false);`,
    `${indent}      return;`,
    `${indent}    }`,
    "",
    `${indent}    if (res.status === 401) {`,
    `${indent}      setReplyError({ kind: "restricted", message: "Login required to whisper." });`,
    `${indent}      setReplyBusy(false);`,
    `${indent}      return;`,
    `${indent}    }`,
    `${indent}    if (res.status === 403) {`,
    `${indent}      setReplyError({ kind: "restricted", message: "Restricted: you can’t whisper right now." });`,
    `${indent}      setReplyBusy(false);`,
    `${indent}      return;`,
    `${indent}    }`,
    `${indent}    if (res.status >= 500) {`,
    `${indent}      setReplyError({ kind: "server", message: "Server error — whisper not sent. Try again." });`,
    `${indent}      setReplyBusy(false);`,
    `${indent}      return;`,
    `${indent}    }`,
    "",
    `${indent}    setReplyError({ kind: "unknown", message: "Couldn’t whisper — try again." });`,
    `${indent}    setReplyBusy(false);`,
    `${indent}    return;`,
    `${indent}  } catch {`,
    `${indent}    setReplyError({ kind: "network", message: "Network error — whisper not sent. Try again." });`,
    `${indent}    setReplyBusy(false);`,
    `${indent}    return;`,
    `${indent}  }`,
    `${indent}}`,
    "",
  ].join("\n");

  block = block.slice(0, idxFetch) + w + block.slice(idxFetch);
  s = s.slice(0, start) + block + s.slice(endParen + 1);
  s += `\n\n// ${MARK_LOGIC}\n`;
}

fs.writeFileSync(PAGE, s, "utf8");
console.log("PATCHED:", PAGE);

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_956c:** Thread: Whisper to Friends (Public-only toggle + quote-echo into Friends side).";
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
