#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_956e_whisper_to_friends_fix"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Preconditions (prevents wrong directory errors)
for d in frontend backend scripts docs; do
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
  echo "❌ node is required (used for safe in-place patching)."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
mkdir -p "$BK/$(dirname "$PAGE")"
cp -a "$PAGE" "$BK/$PAGE"
if [[ -f "$STATE" ]]; then
  mkdir -p "$BK/$(dirname "$STATE")"
  cp -a "$STATE" "$BK/$STATE" || true
fi

echo "✅ Backup: $BK"
echo ""

echo "== Restore ${PAGE} to git HEAD (removes broken sd_956c injection) =="
git restore "$PAGE" || true
echo "✅ Restored: $PAGE"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

// --- helpers ---
function scanStatementEnd(src, startIdx) {
  // Find semicolon ending statement, ignoring strings/comments and nested delimiters.
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

function insertAfterStatement(src, stmtStartIdx, insertText) {
  const end = scanStatementEnd(src, stmtStartIdx);
  must(end !== -1, "sd_956e: could not find end of statement for insertion.");
  return src.slice(0, end + 1) + "\n" + insertText + "\n" + src.slice(end + 1);
}

function patchReplyScopeState(src) {
  const MARK = "sd_956e_reply_scope_state";
  if (src.includes(MARK)) return src;

  // Try to insert right after replyTo useState statement (multi-line safe)
  const re = /const\s*\[\s*replyTo\s*,\s*setReplyTo\s*\]\s*=\s*useState/m;
  const m = re.exec(src);
  must(m, "sd_956e: could not find replyTo useState statement.");
  const stmtStart = m.index;

  const lineStart = src.lastIndexOf("\n", stmtStart);
  const indent = (lineStart === -1) ? "" : (src.slice(lineStart + 1, stmtStart).match(/^\s*/)?.[0] || "");

  const ins = `${indent}const [replyScope, setReplyScope] = useState<"thread" | "friends">("thread"); // ${MARK}`;
  return insertAfterStatement(src, stmtStart, ins);
}

function patchComposerUI(src) {
  const MARK = "sd_956e_whisper_toggle_ui";
  if (src.includes(MARK)) return src;

  const anchor = `<div className="flex gap-3 py-4 border-t border-b border-gray-100">`;
  const idx = src.indexOf(anchor);
  must(idx >= 0, "sd_956e: could not find composer textarea row container anchor.");

  const ls = src.lastIndexOf("\n", idx);
  const indent = ls === -1 ? "" : (src.slice(ls + 1, idx).match(/^\s*/)?.[0] || "");

  const ui = [
    `${indent}{/* ${MARK}: Public-only whisper toggle */}`,
    `${indent}{found?.side === "public" ? (`,
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

  return src.slice(0, idx) + ui + src.slice(idx);
}

function patchSendReplyNow(src) {
  const MARK = "sd_956e_whisper_logic";
  if (src.includes(MARK)) return src;

  const startNeedle = "const sendReplyNow = useCallback(async () => {";
  const start = src.indexOf(startNeedle);
  must(start >= 0, "sd_956e: could not find sendReplyNow useCallback start.");

  // Limit edits to within sendReplyNow block by finding the closing `}, [ ... ]);`
  const afterStart = src.indexOf("}, [", start);
  must(afterStart >= 0, "sd_956e: could not find dependency array close for sendReplyNow.");
  const endCall = src.indexOf("]);", afterStart);
  must(endCall >= 0, "sd_956e: could not find end of sendReplyNow useCallback call.");
  const blockEnd = endCall + 3;

  let block = src.slice(start, blockEnd);

  // Inject isWhisper after postSide assignment
  const postSideNeedle = "  const postSide = found.side;";
  must(block.includes(postSideNeedle), "sd_956e: could not find 'const postSide = found.side;' in sendReplyNow.");
  if (!block.includes("const isWhisper")) {
    block = block.replace(
      postSideNeedle,
      `${postSideNeedle}\n  const isWhisper = replyScope === "friends" && postSide === "public"; // ${MARK}`
    );
  }

  // Replace mismatch gate only in this block
  block = block.replace(
    "  if (activeSide !== postSide) {",
    "  if (!isWhisper && activeSide !== postSide) {"
  );

  // Find onlineNow and offline queue comment
  const onlineNeedle = `  const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;`;
  must(block.includes(onlineNeedle), "sd_956e: could not find onlineNow computation line in sendReplyNow.");

  const offlineCommentNeedle = "  // Offline: queue and keep UI truthful.";
  const offlineCommentIdx = block.indexOf(offlineCommentNeedle);
  must(offlineCommentIdx >= 0, "sd_956e: could not find offline queue comment to anchor whisper insertion.");

  // Insert whisper branch before offline queue comment
  const whisper = `
  // ${MARK}: Whisper to Friends = quote-echo into Friends side (public original only)
  if (isWhisper) {
    if (!onlineNow) {
      setReplyError({ kind: "network", message: "Whisper needs internet — try again when online." });
      setReplyBusy(false);
      return;
    }

    try {
      const res = await fetch(\`/api/post/\${encodeURIComponent(found.post.id)}/quote\`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: t,
          side: "friends",
          client_key: \`whisper_\${Date.now().toString(36)}\`,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!data || (data as any).ok !== false) {
          setReplyText("");
          setReplyTo(null);
          setReplyScope("thread");
          setReplyBusy(false);
          toast.success("Whispered to Friends.");
          return;
        }
      }

      const j = await res.json().catch(() => null);
      const code = j && typeof (j as any).error === "string" ? (j as any).error : "request_failed";

      if (res.status === 400) {
        if (code === "too_long" && j && typeof (j as any).max === "number") {
          setReplyError({ kind: "validation", message: \`Too long. Max \${(j as any).max} characters.\` });
        } else if (code === "empty_text") {
          setReplyError({ kind: "validation", message: "Write something first." });
        } else {
          setReplyError({ kind: "validation", message: "Couldn’t whisper — check your text." });
        }
        setReplyBusy(false);
        return;
      }

      if (res.status === 401) {
        setReplyError({ kind: "restricted", message: "Login required to whisper." });
        setReplyBusy(false);
        return;
      }

      if (res.status === 403) {
        setReplyError({ kind: "restricted", message: "Restricted: you can’t whisper right now." });
        setReplyBusy(false);
        return;
      }

      if (res.status >= 500) {
        setReplyError({ kind: "server", message: "Server error — whisper not sent. Try again." });
        setReplyBusy(false);
        return;
      }

      setReplyError({ kind: "unknown", message: "Couldn’t whisper — try again." });
      setReplyBusy(false);
      return;
    } catch {
      setReplyError({ kind: "network", message: "Network error — whisper not sent. Try again." });
      setReplyBusy(false);
      return;
    }
  }

`;

  block = block.slice(0, offlineCommentIdx) + whisper + block.slice(offlineCommentIdx);

  // Ensure replyScope is in deps
  const depsStart = block.lastIndexOf("}, [");
  const depsClose = block.lastIndexOf("]);");
  if (depsStart >= 0 && depsClose > depsStart) {
    const deps = block.slice(depsStart + 4, depsClose); // inside [...]
    if (!deps.includes("replyScope")) {
      const depsTrim = deps.trim();
      const newDeps = depsTrim ? (depsTrim + ", replyScope") : "replyScope";
      block = block.slice(0, depsStart + 4) + newDeps + block.slice(depsClose);
    }
  }

  const out = src.slice(0, start) + block + src.slice(blockEnd);
  return out;
}

// --- apply patches ---
let src = fs.readFileSync(PAGE, "utf8");

// Ensure dynamic export newline correctness
src = src.replace(/export const dynamic = "force-dynamic";\s*import\s+/m, `export const dynamic = "force-dynamic";\nimport `);

src = patchReplyScopeState(src);
src = patchComposerUI(src);
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
