#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_956b_whisper_to_friends_v2"
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

// --- small lexer helpers (ignore strings/comments for scans) ---
function scanMatch(source, openIdx, openChar, closeChar) {
  let depth = 0;
  let inS = false, inD = false, inB = false, inLine = false, inBlock = false;
  let esc = false;

  for (let i = openIdx; i < source.length; i++) {
    const c = source[i];
    const n = source[i + 1];

    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; i++; } continue; }

    if (inS) { if (!esc && c === "'") inS = false; esc = (!esc && c === "\\"); continue; }
    if (inD) { if (!esc && c === '"') inD = false; esc = (!esc && c === "\\"); continue; }
    if (inB) { if (!esc && c === "`") inB = false; esc = (!esc && c === "\\"); continue; }

    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    if (c === "'") { inS = true; esc = false; continue; }
    if (c === '"') { inD = true; esc = false; continue; }
    if (c === "`") { inB = true; esc = false; continue; }

    if (c === openChar) depth++;
    if (c === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findSendReplyNowUseCallbackRange(src) {
  const m = src.match(/const\s+sendReplyNow\s*=\s*useCallback\s*\(/);
  if (!m) return null;
  const start = src.indexOf(m[0]);
  const open = src.indexOf("(", start);
  if (open < 0) return null;
  const close = scanMatch(src, open, "(", ")");
  if (close < 0) return null;
  return [start, close];
}

function findReplyToStateLine(src) {
  const re = /(^\s*const\s*\[\s*replyTo\s*,\s*setReplyTo\s*\]\s*=\s*useState[^\n;]*;\s*$)/m;
  const m = src.match(re);
  return m ? m[1] : null;
}

// --- patch starts ---
let s = fs.readFileSync(PAGE, "utf8");

// 0) Ensure import spacing is sane (idempotent)
s = s.replace(/export const dynamic = "force-dynamic";\s*import\s+/m, `export const dynamic = "force-dynamic";\n\nimport `);

// 1) Add replyScope state
const markerState = "sd_956b_reply_scope_state";
if (!s.includes(markerState)) {
  const line = findReplyToStateLine(s);
  must(line, "sd_956b: could not find replyTo/setReplyTo useState line to insert replyScope.");

  const insert = line + `\n  const [replyScope, setReplyScope] = useState<"thread" | "friends">("thread"); // ${markerState}`;
  s = s.replace(line, insert);
}

// 2) Insert Whisper toggle UI above sticky textarea row
const markerUi = "sd_956b_whisper_toggle_ui";
if (!s.includes(markerUi)) {
  const anchor = `<div className="px-4 py-3 flex items-end gap-3">`;
  const idx = s.indexOf(anchor);
  must(idx >= 0, "sd_956b: could not find sticky composer row container (expected px-4 py-3 flex items-end gap-3).");

  const ui = `
                {/* ${markerUi}: Public-only whisper toggle */}
                {found.side === "public" ? (
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-3 border-t border-gray-50">
                    <button
                      type="button"
                      onClick={() => setReplyScope((cur) => (cur === "thread" ? "friends" : "thread"))}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-[11px] font-extrabold",
                        replyScope === "friends"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-blue-50 border-blue-200 text-blue-800"
                      )}
                      title="Toggle reply scope"
                    >
                      {replyScope === "friends" ? "Whisper to Friends" : "Reply to Public"}
                    </button>

                    {replyScope === "friends" ? (
                      <div className="text-[11px] font-bold text-gray-500 truncate">
                        Friends only
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold text-gray-400 truncate">
                        Public thread
                      </div>
                    )}
                  </div>
                ) : null}

`;
  s = s.slice(0, idx) + ui + s.slice(idx);
}

// 3) sendReplyNow: whisper branch
const markerLogic = "sd_956b_whisper_logic";
if (!s.includes(markerLogic)) {
  const r = findSendReplyNowUseCallbackRange(s);
  must(r, "sd_956b: could not locate const sendReplyNow = useCallback(...).");

  const [start, endParen] = r;
  const block = s.slice(start, endParen + 1);

  // Ensure replyScope is in deps
  let patchedBlock = block;
  const depsStart = patchedBlock.lastIndexOf("[");
  const depsEnd = patchedBlock.lastIndexOf("]");
  must(depsStart >= 0 && depsEnd > depsStart, "sd_956b: could not find dependency array for sendReplyNow.");
  const depsInner = patchedBlock.slice(depsStart + 1, depsEnd);
  if (!/\breplyScope\b/.test(depsInner)) {
    const depsNew = depsInner.trim().length ? (depsInner.trimEnd() + ", replyScope") : "replyScope";
    patchedBlock = patchedBlock.slice(0, depsStart + 1) + depsNew + patchedBlock.slice(depsEnd);
  }

  // Add isWhisper right after const t=...trim()
  if (!patchedBlock.includes("const isWhisper")) {
    const tRe = /const\s+t\s*=\s*String\([^)]*\)\.trim\(\)\s*;?/m;
    const mT = patchedBlock.match(tRe);
    must(mT, "sd_956b: could not find reply text normalization (const t = String(...).trim()).");
    patchedBlock = patchedBlock.replace(mT[0], mT[0] + `\n    const isWhisper = replyScope === "friends" && found.side === "public"; // ${markerLogic}`);
  }

  const replyNeedle = "fetch(`/api/post/${encodeURIComponent(found.post.id)}/reply`";
  const idxReply = patchedBlock.indexOf(replyNeedle);
  must(idxReply >= 0, "sd_956b: could not find /reply fetch in sendReplyNow.");

  const whisper = `
    // ${markerLogic}: whisper to Friends = quote-echo into Friends side (public original only)
    if (isWhisper) {
      const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;
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

        const j = (await res.json().catch(() => null)) as any;

        if (res.ok && (!j || j.ok !== false)) {
          setReplyText("");
          setReplyTo(null);
          setReplyScope("thread");
          setReplyBusy(false);
          toast.success("Whispered to Friends.");
          return;
        }

        const code = j && typeof j.error === "string" ? String(j.error) : "request_failed";

        if (res.status === 400) {
          if (code === "too_long" && j && typeof j.max === "number") {
            setReplyError({ kind: "validation", message: \`Too long. Max \${j.max} characters.\` });
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

  patchedBlock = patchedBlock.slice(0, idxReply) + whisper + patchedBlock.slice(idxReply);

  s = s.slice(0, start) + patchedBlock + s.slice(endParen + 1);
  s += `\n\n// ${markerLogic}\n`;
}

fs.writeFileSync(PAGE, s, "utf8");
console.log("PATCHED:", PAGE);

// STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_956b:** Thread: Whisper to Friends (Public-only toggle + quote-echo into Friends side; no offline queue).";
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
