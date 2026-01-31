#!/usr/bin/env bash
set -euo pipefail

NAME="sd_952_post_detail_thread_clean"
PAGE="frontend/src/app/siddes-post/[id]/page.tsx"

if [[ ! -f "$PAGE" ]]; then
  echo "❌ Run this from your repo root (the folder that contains frontend/)."
  echo "   Missing: $PAGE"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${STAMP}"
mkdir -p "$BK/$(dirname "$PAGE")"
cp "$PAGE" "$BK/$PAGE"

node - <<'NODE'
const fs = require("fs");

const FILE = "frontend/src/app/siddes-post/[id]/page.tsx";
let s = fs.readFileSync(FILE, "utf8");

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- 1) SentReplies: remove its internal header (we render the header in PostDetail now) + tighten spacing ---
{
  const headerRe = /<div className="flex items-baseline gap-2 mb-3">\s*<div className="text-\[11px\] font-black text-gray-900">\{replies\.length === 1 \? "1 Reply" : `\$\{replies\.length\} Replies`\}<\/div>\s*<\/div>/m;
  if (headerRe.test(s)) {
    s = s.replace(headerRe, "");
  }

  // Reduce top margin so it sits nicely inside the Replies card.
  const mtRe = /<div className="mt-6" data-testid="sent-replies">/g;
  s = s.replace(mtRe, '<div className="mt-4" data-testid="sent-replies">');

  // Clean up a weird indentation artifact that can appear after removing the header.
  s = s.replace(/\n\s*\{loading && !replies\.length \? \(/g, "\n      {loading && !replies.length ? (");
}

// --- 2) PostDetailInner tail: replace the UI block (and add a tiny fix to hide duplicate Post options dots) ---
{
  const startNeedle = "const enterSide = () => {";
  const endNeedle = "export default function SiddesPostDetailPage";

  const start = s.indexOf(startNeedle);
  const end = s.indexOf(endNeedle);

  must(start !== -1, "PostDetailInner: could not find enterSide() block.");
  must(end !== -1, "PostDetailInner: could not find export default page function.");
  must(end > start, "PostDetailInner: unexpected ordering (export default before enterSide).");

  const before = s.slice(0, start);
  const after = s.slice(end);

  const mid = `
  const enterSide = () => {
    setSide(postSide, { afterConfirm: () => toast.success("Entered " + postMeta.label + ".") });
  };

  // Post options dots appear twice in some builds (PostCard renders two triggers).
  // Fix: keep the first one, hide the rest — detail-only, zero impact on feed rows.
  const postCardWrapRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      const root = postCardWrapRef.current;
      if (!root) return;
      const btns = Array.from(root.querySelectorAll('button[aria-label="Post options"]'));
      if (btns.length <= 1) return;
      for (let i = 1; i < btns.length; i++) {
        try {
          (btns[i] as any).style.display = "none";
        } catch {}
      }
    } catch {}
  }, [found?.post?.id]);

  const focusComposer = () => {
    try {
      setReplyTo(null);
      replyInputRef.current?.focus();
    } catch {}
  };

  return (
    <div className="py-4 pb-52">
      <ContentColumn>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center min-w-0">
            <Link href={backHref} className="text-sm font-extrabold text-gray-700 hover:underline truncate">
              ← {backLabel}
            </Link>
            <Badge n={queuedCount} />
          </div>

          {mismatch ? (
            <button
              type="button"
              className={cn(
                "px-4 py-2 rounded-full text-white text-sm font-extrabold hover:opacity-90",
                theme.primaryBg
              )}
              onClick={enterSide}
            >
              Enter {postMeta.label}
            </button>
          ) : null}
        </div>

        <SideMismatchBanner active={activeSide} target={postSide} onEnter={enterSide} />

        <div ref={postCardWrapRef}>
          <PostCard
            post={found.post}
            side={found.side}
            showAccentBorder={false}
            calmHideCounts={found.side === "public" && FLAGS.publicCalmUi && !(publicCalm?.showCounts)}
          />
        </div>

        {/* Replies */}
        <div className="mt-4 rounded-3xl border border-gray-100 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                Replies{typeof sentReplyCount === "number" ? " (" + String(sentReplyCount) + ")" : ""}
              </div>
              <div className="text-xs text-gray-500 mt-1">Replies stay in the same Side.</div>
            </div>

            {!mismatch ? (
              <button
                type="button"
                onClick={focusComposer}
                className="px-3 py-2 rounded-full border border-gray-200 bg-white text-xs font-extrabold text-gray-800 hover:bg-gray-50 active:bg-gray-50/70"
              >
                Reply
              </button>
            ) : (
              <button
                type="button"
                onClick={enterSide}
                className={cn("px-3 py-2 rounded-full text-xs font-extrabold text-white hover:opacity-90", theme.primaryBg)}
              >
                Enter {postMeta.label}
              </button>
            )}
          </div>

          <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-3">
            <ReplyAvatar label="You" tone="neutral" />
            <button
              type="button"
              onClick={focusComposer}
              disabled={mismatch}
              className={cn(
                "flex-1 text-left text-sm font-bold text-gray-400 py-2",
                mismatch ? "cursor-not-allowed opacity-60" : "hover:text-gray-500"
              )}
            >
              Post your reply…
            </button>
          </div>

          <div className="px-5 py-4">
            <QueuedReplies postId={found.post.id} />

            <SentReplies
              postId={found.post.id}
              onReplyTo={(parentId, label) => {
                setReplyTo({ parentId, label });
                try {
                  replyInputRef.current?.focus();
                } catch {}
              }}
              onCountChange={setSentReplyCount}
            />
          </div>
        </div>
      </ContentColumn>

      {/* Sticky composer */}
      <div
        className="fixed md:static left-0 right-0 z-[90] md:z-auto"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
      >
        <div className="max-w-[680px] mx-auto px-4">
          <div className="rounded-3xl border border-gray-200 bg-white shadow-[0_-10px_24px_-18px_rgba(0,0,0,0.35)] overflow-hidden">
            {mismatch ? (
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-gray-900">
                    Enter <span className={theme.text}>{postMeta.label}</span> to reply
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 truncate">Replies are side-scoped for safety.</div>
                </div>
                <button
                  type="button"
                  onClick={enterSide}
                  className={cn("px-4 py-2 rounded-full text-xs font-extrabold text-white hover:opacity-90", theme.primaryBg)}
                >
                  Enter
                </button>
              </div>
            ) : (
              <>
                {replyTo ? (
                  <div className="px-4 py-2 bg-gray-50 flex items-center justify-between gap-3 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-500 truncate">
                      Replying to <span className="text-gray-900">{replyTo.label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-extrabold text-gray-700 hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}

                {replyError ? <div className="px-4 pt-3 text-xs font-extrabold text-rose-600">{replyError.message}</div> : null}

                <div className="px-4 py-3 flex items-end gap-3">
                  <ReplyAvatar label="You" tone="neutral" />
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={replyInputRef}
                      value={replyText}
                      onChange={(e) => {
                        setReplyText(e.target.value);
                        try {
                          const el = e.target;
                          el.style.height = "auto";
                          el.style.height = Math.min(el.scrollHeight, 160) + "px";
                        } catch {}
                      }}
                      placeholder={replyTo ? "Write your reply…" : "Post your reply…"}
                      className="w-full py-2 resize-none bg-transparent outline-none text-base font-bold placeholder:text-gray-400 leading-5"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          sendReplyNow();
                        }
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={sendReplyNow}
                    disabled={replyBusy || !replyText.trim()}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-extrabold text-white",
                      (replyBusy || !replyText.trim()) ? "bg-gray-200 cursor-not-allowed" : theme.primaryBg
                    )}
                  >
                    {replyBusy ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
`;

  s = before + mid + after;
}

fs.writeFileSync(FILE, s, "utf8");
console.log("OK: patched", FILE);
NODE

echo ""
echo "✅ $NAME applied."
echo "Backup saved to: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$PAGE\" \"$PAGE\""
