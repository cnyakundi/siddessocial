#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_956_whisper_to_friends"
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
mkdir -p "$BK/frontend/src/app/siddes-post/[id]" 2>/dev/null || true
cp -a "$PAGE" "$BK/$PAGE"
if [[ -f "$STATE" ]]; then
  mkdir -p "$BK/docs" 2>/dev/null || true
  cp -a "$STATE" "$BK/$STATE" || true
fi

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

let s = fs.readFileSync(PAGE, "utf8");

// Formatting fix
s = s.replace(/export const dynamic = "force-dynamic";\s*import\s+/m, `export const dynamic = "force-dynamic";\n\nimport `);

// 1) Add replyScope state
const markerState = "sd_956_reply_scope_state";
if (!s.includes(markerState)) {
  const needle = `const [replyTo, setReplyTo] = useState<{ parentId: string | null; label: string } | null>(null);`;
  must(s.includes(needle), "sd_956: could not find replyTo state line (file drift).");
  s = s.replace(
    needle,
    needle + `\n  const [replyScope, setReplyScope] = useState<"thread" | "friends">("thread"); // ${markerState}\n`
  );
}

// 2) UI toggle in composer
const markerUi = "sd_956_whisper_toggle_ui";
if (!s.includes(markerUi)) {
  const target = `<div className="flex gap-3 py-4 border-t border-b border-gray-100">`;
  must(s.includes(target), "sd_956: could not find composer textarea row container (file drift).");

  const ui = `
              {/* ${markerUi}: whisper toggle (Public only) */}
              {String(found?.side || "public") === "public" ? (
                <div className="flex items-center justify-between gap-3 mb-2">
                  <button
                    type="button"
                    onClick={() => setReplyScope((v) => (v === "thread" ? "friends" : "thread"))}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-[11px] font-extrabold",
                      replyScope === "friends"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-blue-50 border-blue-200 text-blue-800"
                    )}
                    aria-label="Toggle reply scope"
                    title="Toggle reply scope"
                  >
                    {replyScope === "friends" ? "Whisper to Friends" : "Reply to Public"}
                  </button>

                  {replyScope === "friends" ? (
                    <div className="text-[11px] font-bold text-gray-500">
                      Friends only
                    </div>
                  ) : null}
                </div>
              ) : null}

`;
  s = s.replace(target, ui + "              " + target);
}

// 3) sendReplyNow: whisper branch + gates
const markerLogic = "sd_956_whisper_logic";
if (!s.includes(markerLogic)) {
  const gateNeedle = `  const postSide = found.side;\n  if (activeSide !== postSide) {`;
  must(s.includes(gateNeedle), "sd_956: could not find activeSide mismatch gate in sendReplyNow (file drift).");
  s = s.replace(
    gateNeedle,
    `  const postSide = found.side;\n  const isWhisper = replyScope === "friends" && postSide === "public"; // ${markerLogic}\n  if (!isWhisper && activeSide !== postSide) {`
  );

  const offlineNeedle = `  if (!onlineNow) {`;
  must(s.includes(offlineNeedle), "sd_956: could not find offline queue block (file drift).");
  if (!s.includes("Whisper needs internet")) {
    s = s.replace(
      offlineNeedle,
      `  if (!onlineNow) {\n    if (isWhisper) {\n      setReplyError({ kind: "network", message: "Whisper needs internet — try again when online." });\n      setReplyBusy(false);\n      return;\n    }\n`
    );
  }

  const replyFetchNeedle = "const res = await fetch(`/api/post/${encodeURIComponent(found.post.id)}/reply`";
  const idxFetch = s.indexOf(replyFetchNeedle);
  must(idxFetch >= 0, "sd_956: could not find reply fetch to /reply (file drift).");

  const insertAt = s.lastIndexOf("try {", idxFetch);
  must(insertAt >= 0, "sd_956: could not find try { before reply fetch (file drift).");

  const whisperBlock = `
  // ${markerLogic}: whisper sends a Friends-side quote-echo instead of replying in public thread
  if (isWhisper) {
    try {
      const res = await fetch(\`/api/post/\${encodeURIComponent(found.post.id)}/quote\`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t, side: "friends", client_key: \`whisper_\${Date.now().toString(36)}\` }),
      });

      const j = await res.json().catch(() => null) as any;

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
  s = s.slice(0, insertAt) + whisperBlock + s.slice(insertAt);

  // deps include replyScope
  s = s.replace(/\},\s*\[found,\s*activeSide,\s*replyText,\s*replyTo,\s*replyBusy\]\);\s*/m, "}, [found, activeSide, replyText, replyTo, replyBusy, replyScope]);\n");
}

fs.writeFileSync(PAGE, s, "utf8");
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
