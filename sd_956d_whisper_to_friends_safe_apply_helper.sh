#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_956d_whisper_to_friends_safe"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

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
mkdir -p "$BK"
mkdir -p "$BK/$(dirname "$PAGE")"
cp -a "$PAGE" "$BK/$PAGE"
[[ -f "$STATE" ]] && { mkdir -p "$BK/$(dirname "$STATE")"; cp -a "$STATE" "$BK/$STATE"; } || true

echo "✅ Backup: $BK"
echo ""

echo "== Restore file(s) to HEAD (removes broken sd_956c injection) =="
git restore "$PAGE" || true
git restore "$STATE" 2>/dev/null || true
echo "✅ Restored: $PAGE (and STATE if present)"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

function scanMatch(src, openIdx, openChar, closeChar) {
  let depth = 0;
  let inS=false, inD=false, inB=false, inLine=false, inBlock=false;
  let esc=false;

  for (let i = openIdx; i < src.length; i++) {
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

    if (c===openChar) depth++;
    if (c===closeChar) {
      depth--;
      if (depth===0) return i;
    }
  }
  return -1;
}

function findSendReplyNowUseCallbackRange(src) {
  const needle = "const sendReplyNow = useCallback(";
  const start = src.indexOf(needle);
  if (start < 0) return null;
  const open = src.indexOf("(", start);
  if (open < 0) return null;
  const close = scanMatch(src, open, "(", ")");
  if (close < 0) return null;
  return [start, close];
}

function scanStatementEnd(src, startIdx) {
  let paren=0, brace=0, angle=0;
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
    if (c==="<") angle++;
    if (c===">") angle = Math.max(0, angle-1);

    if (c===";" && paren===0 && brace===0 && angle===0) return i;
  }
  return -1;
}

function insertReplyScopeState(src) {
  const MARK = "sd_956d_reply_scope_state";
  if (src.includes(MARK)) return src;

  const reReplyText = /^(\s*const\s*\[\s*replyText\s*,\s*setReplyText\s*\]\s*=\s*useState[^\n]*;?\s*)$/m;
  const m = src.match(reReplyText);
  if (m && m[1]) {
    const indent = (m[1].match(/^\s*/) || [""])[0];
    const ins = `${m[1]}\n${indent}const [replyScope, setReplyScope] = useState<"thread" | "friends">("thread"); // ${MARK}`;
    return src.replace(m[1], ins);
  }

  const reReplyToStart = /const\s*\[\s*replyTo\s*,\s*setReplyTo\s*\]\s*=\s*useState/m;
  const mm = reReplyToStart.exec(src);
  must(mm, "sd_956d: could not find replyText state OR replyTo useState to anchor replyScope insertion.");

  const stmtStart = mm.index;
  const stmtEnd = scanStatementEnd(src, stmtStart);
  must(stmtEnd !== -1, "sd_956d: could not find end of replyTo useState statement.");

  const lineStart = src.lastIndexOf("\n", stmtStart);
  const indent = (lineStart === -1) ? "" : (src.slice(lineStart + 1, stmtStart).match(/^\s*/)?.[0] || "");
  const insertLine = `\n${indent}const [replyScope, setReplyScope] = useState<"thread" | "friends">("thread"); // ${MARK}\n`;
  return src.slice(0, stmtEnd + 1) + insertLine + src.slice(stmtEnd + 1);
}

function insertWhisperToggleUI(src) {
  const MARK = "sd_956d_whisper_toggle_ui";
  if (src.includes(MARK)) return src;

  const needle = 'data-testid="thread-inline-composer"';
  const idx = src.indexOf(needle);
  must(idx >= 0, "sd_956d: could not find thread-inline-composer to insert toggle UI.");

  const tagEnd = src.indexOf(">", idx);
  must(tagEnd > 0, "sd_956d: could not parse thread-inline-composer opening tag.");

  const lineStart = src.lastIndexOf("\n", tagEnd);
  const indent = (lineStart === -1) ? "                " : (src.slice(lineStart + 1, tagEnd + 1).match(/^\s*/)?.[0] || "                ");

  const ui = [
    "",
    `${indent}{/* ${MARK}: Public-only whisper toggle */}`,
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
  ].join("\n");

  return src.slice(0, tagEnd + 1) + ui + src.slice(tagEnd + 1);
}

function patchSendReplyNowForWhisper(src) {
  const MARK = "sd_956d_whisper_logic";
  if (src.includes(MARK)) return src;

  const range = findSendReplyNowUseCallbackRange(src);
  must(range, "sd_956d: could not find sendReplyNow useCallback block.");

  const [start, endParen] = range;
  let block = src.slice(start, endParen + 1);

  const depsStart = block.lastIndexOf("[");
  const depsEnd = block.lastIndexOf("]");
  must(depsStart >= 0 && depsEnd > depsStart, "sd_956d: could not find deps array in sendReplyNow.");
  const depsInner = block.slice(depsStart + 1, depsEnd);
  if (!/\breplyScope\b/.test(depsInner)) {
    const innerTrim = depsInner.trim();
    const depsNew = innerTrim ? (innerTrim + ", replyScope") : "replyScope";
    block = block.slice(0, depsStart + 1) + depsNew + block.slice(depsEnd);
  }

  const postSideNeedle = "const postSide = found.side;";
  must(block.includes(postSideNeedle), "sd_956d: could not find 'const postSide = found.side;' in sendReplyNow.");
  if (!block.includes("const isWhisper")) {
    block = block.replace(
      postSideNeedle,
      postSideNeedle + `\n    const isWhisper = replyScope === "friends" && postSide === "public"; // ${MARK}`
    );
  }

  block = block.replace(/if\s*\(\s*activeSide\s*!==\s*postSide\s*\)\s*\{/m, "if (!isWhisper && activeSide !== postSide) {");

  const onlineIdx = block.search(/const\s+onlineNow\s*=\s*typeof\s+navigator\b[\s\S]*?;\s*/m);
  must(onlineIdx >= 0, "sd_956d: could not find onlineNow computation in sendReplyNow.");
  const offlineNeedleIdx = block.indexOf("if (!onlineNow) {", onlineIdx);
  must(offlineNeedleIdx >= 0, "sd_956d: could not find offline queue block (if (!onlineNow) {).");

  const ls = block.lastIndexOf("\n", offlineNeedleIdx);
  const indent = (ls === -1) ? "    " : (block.slice(ls + 1, offlineNeedleIdx).match(/^\s*/)?.[0] || "    ");

  const whisper = [
    "",
    `${indent}// ${MARK}: Whisper to Friends = quote-echo into Friends side (public original only).`,
    `${indent}if (isWhisper) {`,
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
    `${indent}    if (res.ok && (!j || (j as any).ok !== false)) {`,
    `${indent}      setReplyText("");`,
    `${indent}      setReplyTo(null);`,
    `${indent}      setReplyScope("thread");`,
    `${indent}      setReplyBusy(false);`,
    `${indent}      toast.success("Whispered to Friends.");`,
    `${indent}      return;`,
    `${indent}    }`,
    "",
    `${indent}    const code = j && typeof (j as any).error === "string" ? String((j as any).error) : "request_failed";`,
    `${indent}    if (res.status === 400) {`,
    `${indent}      if (code === "too_long" && j && typeof (j as any).max === "number") {`,
    `${indent}        setReplyError({ kind: "validation", message: \`Too long. Max \${(j as any).max} characters.\` });`,
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
    ""
  ].join("\n");

  block = block.slice(0, offlineNeedleIdx) + whisper + block.slice(offlineNeedleIdx);

  let out = src.slice(0, start) + block + src.slice(endParen + 1);
  out += `\n\n// ${MARK}\n`;
  return out;
}

let src = fs.readFileSync(PAGE, "utf8");
src = src.replace(/export const dynamic = "force-dynamic";\s*import\s+/m, `export const dynamic = "force-dynamic";\n\nimport `);

src = insertReplyScopeState(src);
src = insertWhisperToggleUI(src);
src = patchSendReplyNowForWhisper(src);

fs.writeFileSync(PAGE, src, "utf8");
console.log("PATCHED:", PAGE);

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_956:** Thread: Whisper to Friends on Public posts (composer toggle + quote-echo to Friends-side).";
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
