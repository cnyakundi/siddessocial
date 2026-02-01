#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_956d_whisper_to_friends_safe"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Preconditions (prevents wrong directory + cd frontend errors)
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
  echo "❌ node is required (for safe patching)."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK"
mkdir -p "$BK/$(dirname "$PAGE")"
cp -a "$PAGE" "$BK/$PAGE"
mkdir -p "$BK/$(dirname "$STATE")"
cp -a "$STATE" "$BK/$STATE" || true

echo "✅ Backup: $BK"
echo ""

# Restore page.tsx to HEAD to remove broken sd_956c injection (if present).
# Safe because we already backed it up above.
echo "== Restore page.tsx to HEAD (removes broken injection) =="
git restore "$PAGE" || true
echo "✅ Restored: $PAGE"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

let s = fs.readFileSync(PAGE, "utf8");

// 0) Tiny hygiene: ensure newline after `export const dynamic...;import`
s = s.replace(/export const dynamic = "force-dynamic";\s*import\s+/m, `export const dynamic = "force-dynamic";\nimport `);

// 1) Add replyScope state after replyTo line (idempotent)
const MARK_STATE = "sd_956d_reply_scope_state";
if (!s.includes(MARK_STATE)) {
  const re = /(\s*const\s*\[\s*replyTo\s*,\s*setReplyTo\s*\]\s*=\s*useState[^\n;]*;\s*)/m;
  const m = s.match(re);
  must(m && m[1], "sd_956d: could not find replyTo state line.");
  const indent = (m[1].match(/^\s*/) || [""])[0];
  const insert = `${m[1]}\n${indent}const [replyScope, setReplyScope] = useState<"thread" | "friends">("thread"); // ${MARK_STATE}\n`;
  s = s.replace(m[1], insert);
}

// 2) Insert whisper toggle UI before the composer row (flex gap-3 ... border-t border-b)
const MARK_UI = "sd_956d_whisper_toggle_ui";
if (!s.includes(MARK_UI)) {
  const anchor = `<div className="flex gap-3 py-4 border-t border-b border-gray-100">`;
  const idx = s.indexOf(anchor);
  must(idx >= 0, "sd_956d: could not find composer row container (flex gap-3 py-4 border-t border-b...).");

  // derive indentation
  const ls = s.lastIndexOf("\n", idx);
  const indent = ls === -1 ? "              " : (s.slice(ls + 1, idx).match(/^\s*/)?.[0] || "              ");

  const ui = [
    `${indent}{/* ${MARK_UI}: Public-only whisper toggle */}`,
    `${indent}{found?.side === "public" ? (`,
    `${indent}  <div className="mb-2 flex items-center justify-between gap-3">`,
    `${indent}    <button`,
    `${indent}      type="button"`,
    `${indent}      onClick={() => setReplyScope((cur) => (cur === "thread" ? "friends" : "thread"))}`,
    `${indent}      className={cn(`,
    `${indent}        "px-3 py-1.5 rounded-full border text-[11px] font-extrabold",`,
    `${indent}        replyScope === "friends" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-blue-50 border-blue-200 text-blue-800"`,
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

  s = s.slice(0, idx) + ui + s.slice(idx);
}

// 3) Patch sendReplyNow to support whisper -> quote echo into Friends
const MARK_LOGIC = "sd_956d_whisper_logic";
if (!s.includes(MARK_LOGIC)) {
  // Find the sendReplyNow useCallback block and operate with targeted replacements (stable on this repo)
  must(s.includes("const sendReplyNow = useCallback(async () => {"), "sd_956d: could not find sendReplyNow useCallback start.");

  // 3a) Insert isWhisper after `const postSide = found.side;`
  const postSideNeedle = `  const postSide = found.side;`;
  must(s.includes(postSideNeedle), "sd_956d: could not find 'const postSide = found.side;'.");
  s = s.replace(
    postSideNeedle,
    `${postSideNeedle}\n  const isWhisper = replyScope === "friends" && postSide === "public"; // ${MARK_LOGIC}`
  );

  // 3b) Bypass mismatch gate for whisper
  s = s.replace(
    /if\s*\(\s*activeSide\s*!==\s*postSide\s*\)\s*\{\s*\n\s*toast\.error\(`Enter \${SIDES\[postSide\]\.label} to reply\.\);?\s*\n\s*return;\s*\n\s*\}/m,
    `if (!isWhisper && activeSide !== postSide) {\n    toast.error(\`Enter \${SIDES[postSide].label} to reply.\`);\n    return;\n  }`
  );

  // 3c) Ensure whisper doesn't get queued offline: insert block before offline queue `if (!onlineNow) {`
  const offlineNeedle = `  if (!onlineNow) {`;
  const offlineIdx = s.indexOf(offlineNeedle);
  must(offlineIdx >= 0, "sd_956d: could not find offline queue block (if (!onlineNow) {).");

  // Insert whisper branch just before offline queue block
  const insertBeforeOffline = `
  // ${MARK_LOGIC}: Whisper to Friends = quote-echo into Friends side (public original only)
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

      const j = await res.json().catch(() => null);

      if (res.ok && (!j || (j as any).ok !== false)) {
        setReplyText("");
        setReplyTo(null);
        setReplyScope("thread");
        setReplyBusy(false);
        toast.success("Whispered to Friends.");
        return;
      }

      const code = j && typeof (j as any).error === "string" ? String((j as any).error) : "request_failed";

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
        setReplyError({ kind: "restricted", message: "Restricted: you can’t whisper here." });
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

  s = s.slice(0, offlineIdx) + insertBeforeOffline + s.slice(offlineIdx);

  // 3d) Add replyScope to sendReplyNow deps
  // Current deps: }, [found, activeSide, replyText, replyTo, replyBusy]);
  s = s.replace(/\},\s*\[found,\s*activeSide,\s*replyText,\s*replyTo,\s*replyBusy\]\);\s*/m, "}, [found, activeSide, replyText, replyTo, replyBusy, replyScope]);\n");
}

// Write back
fs.writeFileSync(PAGE, s, "utf8");
console.log("PATCHED:", PAGE);

// docs/STATE.md best-effort update
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
