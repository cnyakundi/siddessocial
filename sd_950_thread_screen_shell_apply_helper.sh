#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_950_thread_screen_shell"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# --- Preconditions ---
TARGET_FILE="frontend/src/app/siddes-post/[id]/page.tsx"
STATE_FILE="docs/STATE.md"

if [[ ! -f "${TARGET_FILE}" ]]; then
  echo "❌ Missing: ${TARGET_FILE}"
  echo "Run this from your repo root (sidesroot)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required (used for safe in-place patching)."
  echo "Install Node.js, then re-run."
  exit 1
fi

# --- Backup ---
TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "${BK}"
cp -f "${TARGET_FILE}" "${BK}/page.tsx.bak"
if [[ -f "${STATE_FILE}" ]]; then
  cp -f "${STATE_FILE}" "${BK}/STATE.md.bak" || true
fi

echo "✅ Backup saved to: ${BK}"
echo ""

# --- Patch (Node) ---
node <<'NODE'
const fs = require("fs");

const TARGET_FILE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE_FILE = "docs/STATE.md";

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

let s = fs.readFileSync(TARGET_FILE, "utf8");

// 0) Formatting fix: ensure newlines after "use client" and dynamic export.
s = s.replace(/"use client";\s*export const dynamic = "force-dynamic";\s*import\s+/m, `"use client";\nexport const dynamic = "force-dynamic";\n\nimport `);
s = s.replace(/export const dynamic = "force-dynamic";\s*import\s+/m, `export const dynamic = "force-dynamic";\n\nimport `);

// 1) Move found-return wrapper into a "screen shell" (sticky header + fixed footer + subtle tint).
const startRe = /return\s*\(\s*\n(\s*)<div className="py-4 pb-28">\s*\n\s*<ContentColumn>/m;
must(startRe.test(s), "sd_950: Could not find main thread return wrapper (py-4 pb-28 + ContentColumn).");
s = s.replace(startRe, (_m, indent) => {
  return (
`return (
${indent}<div className="relative sd-min-h-shell pb-[260px]" data-testid="thread-shell">
${indent}  <div aria-hidden className={cn("absolute inset-0 opacity-30 pointer-events-none", theme.lightBg)} />
${indent}  <ContentColumn className="relative z-10 pt-4">`
  );
});

// 2) Header: convert the back-row into a sticky in-thread header.
const headerRe = /(\s*)<div className="flex items-center justify-between mb-4">([\s\S]*?)<\/div>\s*\n\s*\n\s*<SideMismatchBanner/m;
must(headerRe.test(s), "sd_950: Could not find header row block (mb-4) before SideMismatchBanner.");
s = s.replace(headerRe, (_m, indent, inner) => {
  return (
`${indent}<div
${indent}  className="sticky z-30 bg-white/85 backdrop-blur border-b border-gray-100 -mx-4 px-4"
${indent}  style={{ top: "calc(env(safe-area-inset-top) + var(--siddes-topbar-h))" }}
${indent}  data-testid="thread-header"
${indent}>
${indent}  <div className="flex items-center justify-between py-3">
${inner.trimEnd()}
${indent}  </div>
${indent}</div>

${indent}<SideMismatchBanner`
  );
});

// 3) Remove the inline composer block inside the Replies card (we’ll render it in the fixed footer).
const composerRe = /(\s*)\{mismatch\s*\?\s*\([\s\S]*?data-testid="thread-inline-composer"[\s\S]*?\)\s*\}\s*\n\s*\n\s*<QueuedReplies/m;
must(composerRe.test(s), "sd_950: Could not find inline composer block (mismatch ? ... thread-inline-composer ...) before QueuedReplies.");
s = s.replace(composerRe, (_m, indent) => {
  return (
`${indent}{/* sd_950: composer moved to sticky footer */}\n\n${indent}<QueuedReplies`
  );
});

// 4) Insert the fixed footer composer right before the end of PostDetailInner’s main return.
const endRe = /(\s*)<\/ContentColumn>\s*\n\s*\n\s*<\/div>\s*\n\s*\);\s*\n\s*}\s*\n\s*\nexport default function SiddesPostDetailPage/m;
must(endRe.test(s), "sd_950: Could not find end-of-PostDetailInner return to insert fixed footer composer.");
s = s.replace(endRe, (_m, indent) => {
  const footer =
`${indent}</ContentColumn>

${indent}<div
${indent}  className="fixed left-0 right-0 z-[95] bottom-[calc(88px+env(safe-area-inset-bottom))] lg:bottom-0"
${indent}  data-testid="thread-fixed-composer"
${indent}>
${indent}  <div className="w-full max-w-[680px] mx-auto px-4">
${indent}    <div className="bg-white border border-gray-200 rounded-3xl shadow-[0_-12px_32px_rgba(0,0,0,0.08)]">
${indent}      {mismatch ? (
${indent}        <div className="p-4 flex items-center justify-between gap-3">
${indent}          <div className="text-sm font-bold text-gray-700">
${indent}            Enter <span className={theme.text}>{postMeta.label}</span> to reply.
${indent}          </div>
${indent}          <button
${indent}            type="button"
${indent}            className={cn("px-4 py-2 rounded-full text-white text-sm font-extrabold hover:opacity-90", theme.primaryBg)}
${indent}            onClick={enterSide}
${indent}          >
${indent}            Enter {postMeta.label}
${indent}          </button>
${indent}        </div>
${indent}      ) : (
${indent}        <div className="p-3" data-testid="thread-inline-composer">
${indent}          {replyError ? (
${indent}            <div className="text-xs font-extrabold text-rose-600 mb-2">{replyError.message}</div>
${indent}          ) : null}

${indent}          {replyTo ? (
${indent}            <div className="flex items-center justify-between gap-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">
${indent}              <span className="truncate">Replying to {replyTo.label}</span>
${indent}              <button
${indent}                type="button"
${indent}                className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
${indent}                onClick={() => setReplyTo(null)}
${indent}              >
${indent}                Clear
${indent}              </button>
${indent}            </div>
${indent}          ) : null}

${indent}          <div className="flex gap-3">
${indent}            <ReplyAvatar label="You" tone="neutral" />
${indent}            <div className="flex-1 min-w-0">
${indent}              <textarea
${indent}                ref={replyInputRef}
${indent}                value={replyText}
${indent}                onChange={(e) => {
${indent}                  setReplyText(e.target.value);
${indent}                  try {
${indent}                    const el = e.target as HTMLTextAreaElement;
${indent}                    el.style.height = "auto";
${indent}                    el.style.height = Math.min(el.scrollHeight, 160) + "px";
${indent}                  } catch {}
${indent}                }}
${indent}                placeholder="Add a reply…"
${indent}                className="w-full py-2 resize-none bg-transparent outline-none text-base font-bold placeholder:text-gray-400 leading-5"
${indent}                rows={1}
${indent}                onKeyDown={(e) => {
${indent}                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
${indent}                    e.preventDefault();
${indent}                    sendReplyNow();
${indent}                    return;
${indent}                  }
${indent}                  if (e.key === "Enter" && !e.shiftKey) {
${indent}                    e.preventDefault();
${indent}                    sendReplyNow();
${indent}                  }
${indent}                }}
${indent}                aria-label="Write a reply"
${indent}              />
${indent}            </div>
${indent}            <button
${indent}              type="button"
${indent}              onClick={sendReplyNow}
${indent}              disabled={replyBusy || !replyText.trim()}
${indent}              className={cn(
${indent}                "px-4 py-2 rounded-full text-sm font-extrabold text-white",
${indent}                (replyBusy || !replyText.trim()) ? "bg-gray-200 cursor-not-allowed" : theme.primaryBg
${indent}              )}
${indent}            >
${indent}              {replyBusy ? "Sending…" : "Send"}
${indent}            </button>
${indent}          </div>
${indent}        </div>
${indent}      )}
${indent}    </div>
${indent}  </div>
${indent}</div>

${indent}</div>
  );
}
\n\nexport default function SiddesPostDetailPage`;

  return footer;
});

fs.writeFileSync(TARGET_FILE, s, "utf8");
console.log("PATCHED:", TARGET_FILE);

// 5) docs/STATE.md best-effort: add sd_950 to NEXT overlay list
try {
  if (fs.existsSync(STATE_FILE)) {
    const MARK = "**sd_950:** Thread UI shell: sticky in-thread header + move reply composer to fixed footer (no overlap with BottomNav) + subtle Side tint in Post Detail.";
    let t = fs.readFileSync(STATE_FILE, "utf8");
    if (!t.includes(MARK)) {
      const line = `- ${MARK}\n`;
      if (t.includes("## NEXT overlay")) {
        t = t.replace("## NEXT overlay", "## NEXT overlay\n" + line);
      } else {
        t += "\n\n## NEXT overlay\n" + line;
      }
      fs.writeFileSync(STATE_FILE, t, "utf8");
      console.log("PATCHED:", STATE_FILE);
    } else {
      console.log("SKIP:", STATE_FILE, "(already has sd_950)");
    }
  } else {
    console.log("SKIP:", STATE_FILE, "(not found)");
  }
} catch (e) {
  console.log("WARN: STATE.md patch failed (non-fatal):", String(e && e.message ? e.message : e));
}
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
