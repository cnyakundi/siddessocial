#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_956f_whisper_to_friends_anchorfix"
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

echo "== Restore page.tsx to git HEAD (removes broken sd_956c injection) =="
git restore "$PAGE" 2>/dev/null || git checkout -- "$PAGE"
echo "✅ Restored: $PAGE"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

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

    // generic angle for useState<...>(...)
    if (c==="<") angle++;
    if (c===">") angle = Math.max(0, angle-1);

    if (c===";" && paren===0 && brace===0 && angle===0) return i;
  }
  return -1;
}

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

function insertReplyScopeState(src) {
  const MARK = "sd_956f_reply_scope_state";
  if (src.includes(MARK)) return src;

  // Find replyTo useState start (handles multiline)
  const re = /const\s*\[\s*replyTo\s*,\s*setReplyTo\s*\]\s*=\s*useState/m;
  const m = re.exec(src);
  must(m, "sd_956f: could not find replyTo useState statement.");
  const start = m.index;
  const end = scanStatementEnd(src, start);
  must(end !== -1, "sd_956f: could not find end of replyTo useState statement.");

  const lineStart = src.lastIndexOf("\n", start);
  const indent = (lineStart === -1) ? "" : (src.slice(lineStart + 1, start).match(/^\s*/)?.[0] || "");

  const ins = `${indent}const [replyScope, setReplyScope] = useState<"thread" | "friends">("thread"); // ${MARK}`;
  return src.slice(0, end + 1) + "\n" + ins + "\n" + src.slice(end + 1);
}

function insertToggleUI(src) {
  const MARK = "sd_956f_whisper_toggle_ui";
  if (src.includes(MARK)) return src;

  const avatarNeedle = `<ReplyAvatar label="You" tone="neutral" />`;
  const avatarIdx = src.indexOf(avatarNeedle);
  must(avatarIdx >= 0, "sd_956f: could not find ReplyAvatar label=\"You\" in composer (file drift).");

  const divNeedle = `<div className="flex gap-3">`;
  const divIdx = src.lastIndexOf(divNeedle, avatarIdx);
  must(divIdx >= 0, "sd_956f: could not find composer row <div className=\"flex gap-3\">.");

  const ls = src.lastIndexOf("\n", divIdx);
  const indent = ls === -1 ? "" : (src.slice(ls + 1, divIdx).match(/^\s*/)?.[0] || "");

  const ui = [
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
    ``,
  ].join("\n");

  return src.slice(0, divIdx) + ui + src.slice(divIdx);
}

function patchSendReplyNow(src) {
  const MARK = "sd_956f_whisper_logic";
  if (src.includes(MARK)) return src;

  const needle = "const sendReplyNow = useCallback";
  const start = src.indexOf(needle);
  must(start >= 0, "sd_956f: could not find const sendReplyNow = useCallback.");

  const useCbIdx = src.indexOf("useCallback", start);
  const openParen = src.indexOf("(", useCbIdx);
  must(openParen >= 0, "sd_956f: could not parse useCallback(");
  const closeParen = scanMatch(src, openParen, "(", ")");
  must(closeParen >= 0, "sd_956f: could not find end of useCallback call.");

  let call = src.slice(start, closeParen + 1);

  if (call.includes(MARK)) return src;

  // Add replyScope to dependency array inside call (last [] in call)
  const lastBracket = call.lastIndexOf("[");
  const lastClose = call.lastIndexOf("]");
  if (lastBracket !== -1 && lastClose !== -1 && lastClose > lastBracket) {
    const deps = call.slice(lastBracket + 1, lastClose);
    if (!deps.includes("replyScope")) {
      const depsTrim = deps.trim();
      const newDeps = depsTrim ? (depsTrim + ", replyScope") : "replyScope";
      call = call.slice(0, lastBracket + 1) + newDeps + call.slice(lastClose);
    }
  }

  // Insert isWhisper after postSide assignment
  const postSideRe = /(\n\s*)(const\s+postSide\s*=\s*found\.side[^;\n]*;)/m;
  must(postSideRe.test(call), "sd_956f: could not find 'const postSide = found.side' in sendReplyNow.");
  call = call.replace(postSideRe, (_m, nlIndent, line) => {
    return `${nlIndent}${line}\n${nlIndent}const isWhisper = replyScope === "friends" && postSide === "public"; // ${MARK}`;
  });

  // Bypass mismatch gate for whisper
  call = call.replace(/if\s*\(\s*activeSide\s*!==\s*postSide\s*\)\s*\{/m, "if (!isWhisper && activeSide !== postSide) {");

  // Insert whisper branch before offline queue
  const offlineIdx = call.indexOf("if (!onlineNow) {");
  must(offlineIdx >= 0, "sd_956f: could not find offline queue block (if (!onlineNow) {).");

  const ls = call.lastIndexOf("\n", offlineIdx);
  const indent = ls === -1 ? "  " : (call.slice(ls + 1, offlineIdx).match(/^\s*/)?.[0] || "  ");

  const w = [
    "",
    `${indent}// ${MARK}: Whisper to Friends = quote-echo into Friends side (public original only)`,
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

  call = call.slice(0, offlineIdx) + w + call.slice(offlineIdx);

  const out = src.slice(0, start) + call + src.slice(closeParen + 1);
  return out;
}

let src = fs.readFileSync(PAGE, "utf8");
src = src.replace(/export const dynamic = "force-dynamic";\s*import\s+/m, `export const dynamic = "force-dynamic";\n\nimport `);

src = insertReplyScopeState(src);
src = insertToggleUI(src);
src = patchSendReplyNow(src);

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
echo "== Quick sanity =="
git diff --stat || true
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
