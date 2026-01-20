#!/usr/bin/env bash
set -euo pipefail

# sd_385_reply_quote_echo_safety_apply_helper.sh
# Composer parity pack: Reply + Quote Echo
# - Never destroy text on failure
# - Queue only when offline
# - Enforce client-side limits (Reply 2000; Quote Echo 800/5000)
# - Align backend Quote Echo with PostCreate gates (length + trust gates)

ROOT="$(pwd)"

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]]; then
  echo "ERROR: Run this from your repo root (the folder that contains ./frontend and ./backend)."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_385_reply_quote_echo_safety_${STAMP}"
mkdir -p "$BK"

backup_file () {
  local rel="$1"
  local src="$ROOT/$rel"
  local dst="$BK/$rel"
  if [[ ! -f "$src" ]]; then
    echo "ERROR: expected file missing: $src"
    exit 1
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
}

echo "== sd_385: Reply + Quote Echo safety parity =="
echo "Backups: $BK"

backup_file "frontend/src/components/ReplyComposer.tsx"
backup_file "frontend/src/components/QuoteEchoComposer.tsx"
backup_file "frontend/src/components/EchoSheet.tsx"
backup_file "frontend/src/components/PostCard.tsx"
backup_file "frontend/src/app/siddes-post/[id]/page.tsx"
backup_file "backend/siddes_post/views.py"

echo "Writing ReplyComposer.tsx (busy/error/counter)..."
cat > "$ROOT/frontend/src/components/ReplyComposer.tsx" <<'EOF'
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Globe, Loader2, Send, X } from "lucide-react";
import type { FeedPost } from "@/src/lib/feedTypes";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { FLAGS } from "@/src/lib/flags";
import { labelForPublicChannel } from "@/src/lib/publicChannels";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type ReplyError = { kind: "validation" | "restricted" | "network" | "server" | "unknown"; message: string } | null;

function SidePill({ side }: { side: SideId }) {
  const t = SIDE_THEMES[side];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-extrabold",
        t.lightBg,
        t.border,
        t.text
      )}
      title={SIDES[side].privacyHint}
    >
      <span className={cn("w-2 h-2 rounded-full", t.primaryBg)} aria-hidden="true" />
      {SIDES[side].label} Side
    </span>
  );
}

function LockPill({ side, label }: { side: SideId; label: string }) {
  const t = SIDE_THEMES[side];
  return (
    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
      <span className={cn("w-1.5 h-1.5 rounded-full", t.primaryBg)} aria-hidden="true" />
      <span className="truncate max-w-[220px]">{label}</span>
    </span>
  );
}

export function ReplyComposer({
  open,
  onClose,
  post,
  side,
  onSend,
  busy = false,
  error = null,
  maxLen = 2000,
}: {
  open: boolean;
  onClose: () => void;
  post: FeedPost | null;
  side: SideId;
  onSend: (text: string) => void | Promise<void>;
  busy?: boolean;
  error?: ReplyError;
  maxLen?: number;
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) return;
    setText("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const audienceLabel = useMemo(() => {
    if (!post) return "";
    if (side === "public") {
      if (FLAGS.publicChannels && post.publicChannel) return labelForPublicChannel(post.publicChannel);
      return "All Topics";
    }
    return post.setLabel ? post.setLabel : `All ${SIDES[side].label}`;
  }, [post, side]);

  const lockLabel = useMemo(() => {
    if (!post) return "";
    if (side === "public") return `Public • ${audienceLabel}`;
    return `${SIDES[side].label} • ${audienceLabel}`;
  }, [post, side, audienceLabel]);

  const charCount = text.length;
  const overLimit = charCount > maxLen;

  const canSend = text.trim().length > 0 && !busy && !overLimit;

  if (!open || !post) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close reply composer"
      />

      <div className={cn("relative w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-200", error ? "ring-2 ring-red-500" : null)}>
        {/* Header: Side lock + Close */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <SidePill side={side} />
            <span className="hidden sm:inline text-xs text-gray-400 font-bold truncate">Reply stays in this Side</span>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Public hint */}
        {side === "public" ? (
          <div className={cn("px-6 py-2 border-b flex items-center justify-between", SIDE_THEMES.public.lightBg, SIDE_THEMES.public.border)}>
            <div className={cn("flex items-center gap-2 text-[11px] font-medium", SIDE_THEMES.public.text)}>
              <Globe size={12} />
              <span>{SIDES.public.privacyHint}. Replies are also public.</span>
            </div>
          </div>
        ) : null}

        <div className="p-6">
          <div className="text-lg font-bold text-gray-900">Reply</div>
          <div className="text-xs text-gray-500 mt-1">To: {post.author}</div>

          <div className="mt-4 p-3 rounded-2xl border border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500 mb-1">Context</div>
            <div className="text-sm font-semibold text-gray-900">{post.author}</div>
            <div className="text-sm text-gray-700 mt-1">{post.content}</div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a reply…"
            className="w-full mt-4 h-28 resize-none outline-none text-base text-gray-900 placeholder:text-gray-400"
            autoFocus
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={cn("text-[10px] font-mono", overLimit ? "text-red-600 font-bold" : "text-gray-400")}>
                {charCount} / {maxLen}
              </span>

              {error ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded-full">
                  <AlertTriangle size={12} />
                  <span className="truncate max-w-[240px]">{error.message}</span>
                </span>
              ) : null}
            </div>

            <LockPill side={side} label={lockLabel} />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void (canSend ? onSend(text.trim()) : null)}
              className={cn(
                "px-5 py-2 rounded-full font-extrabold inline-flex items-center gap-2 shadow-sm active:scale-95 transition",
                canSend ? cn(SIDE_THEMES[side].primaryBg, "text-white hover:opacity-90") : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
              disabled={!canSend}
              aria-disabled={!canSend}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {busy ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

echo "Writing QuoteEchoComposer.tsx (safe submit + counter + inline error)..."
cat > "$ROOT/frontend/src/components/QuoteEchoComposer.tsx" <<'EOF'
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Repeat, X } from "lucide-react";
import type { FeedPost } from "@/src/lib/feedTypes";
import { SIDE_THEMES, type SideId } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function QuoteEchoComposer({
  open,
  onClose,
  post,
  side,
  onSubmit,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  post: FeedPost | null;
  side?: SideId;
  onSubmit: (text: string) => Promise<{ ok: boolean; message?: string }>;
  busy?: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);

  const tgtSide = (side ?? "friends") as SideId;
  const theme = SIDE_THEMES[tgtSide];

  const maxLen = tgtSide === "public" ? 800 : 5000;
  const charCount = text.length;
  const overLimit = charCount > maxLen;

  const canSubmit = text.trim().length > 0 && !busy && !localBusy && !overLimit;

  useEffect(() => {
    if (!open) return;
    setText("");
    setError(null);
    setLocalBusy(false);
  }, [open]);

  if (!open || !post) return null;

  const submit = async () => {
    if (!canSubmit) return;

    const t = text.trim();
    if (!t) {
      setError("Write something first.");
      return;
    }
    if (t.length > maxLen) {
      setError(`Too long. Max ${maxLen} characters.`);
      return;
    }

    setError(null);
    setLocalBusy(true);
    try {
      const res = await onSubmit(t);
      if (res && res.ok) {
        setText("");
        onClose();
        return;
      }
      setError(res?.message || "Couldn’t quote echo — try again.");
    } catch {
      setError("Couldn’t quote echo — try again.");
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[98] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close quote echo composer"
      />
      <div className={cn("relative w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200", error ? "ring-2 ring-red-500" : null)}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-gray-900">Quote Echo</div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add your thoughts…"
          className="w-full h-28 resize-none outline-none text-base text-gray-900 placeholder:text-gray-400"
          autoFocus
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={cn("text-[10px] font-mono", overLimit ? "text-red-600 font-bold" : "text-gray-400")}>
            {charCount} / {maxLen}
          </span>

          {error ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded-full">
              <AlertTriangle size={12} />
              <span className="truncate max-w-[260px]">{error}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-4 p-3 rounded-2xl border border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 mb-1">Echoing</div>
          <div className="text-sm font-semibold text-gray-900">{post.author}</div>
          <div className="text-sm text-gray-700 mt-1">{post.content}</div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            className={cn(
              "px-5 py-2 rounded-full font-extrabold inline-flex items-center gap-2 shadow-sm active:scale-95 transition",
              canSubmit ? cn(theme.primaryBg, "text-white hover:opacity-90") : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
          >
            {(busy || localBusy) ? <Loader2 size={16} className="animate-spin" /> : <Repeat size={16} />}
            {(busy || localBusy) ? "Echoing..." : "Echo"}
          </button>
        </div>
      </div>
    </div>
  );
}
EOF

echo "Writing EchoSheet.tsx (hide Quote Echo when not Public)..."
cat > "$ROOT/frontend/src/components/EchoSheet.tsx" <<'EOF'
"use client";

import React, { useEffect } from "react";
import { Repeat, PenLine, Share2, X } from "lucide-react";
import type { FeedPost } from "@/src/lib/feedTypes";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function EchoSheet({
  open,
  onClose,
  post,
  side,
  onEcho,
  onQuoteEcho,
  onShareExternal,
  echoed = false,
  echoBusy = false,
}: {
  open: boolean;
  onClose: () => void;
  post: FeedPost | null;
  side: SideId;
  onEcho: () => void;
  onQuoteEcho: () => void;
  onShareExternal: () => void;
  echoed?: boolean;
  echoBusy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !post) return null;

  const theme = SIDE_THEMES[side];

  return (
    <div className="fixed inset-0 z-[97] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close echo sheet"
      />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-5">
          <div className="text-lg font-bold text-gray-900">Echo to your Side</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onEcho}
            disabled={echoBusy}
            className={cn(
              "w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left",
              echoBusy ? "opacity-60 cursor-not-allowed" : null
            )}
          >
            <div className={cn("w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm", theme.text)}>
              <Repeat size={20} />
            </div>
            <div>
              {echoed ? (
                <>
                  <div className="font-bold text-gray-900">Un-echo</div>
                  <div className="text-xs text-gray-500">Remove this echo from your current Side</div>
                </>
              ) : (
                <>
                  <div className="font-bold text-gray-900">Echo</div>
                  <div className="text-xs text-gray-500">Instantly share to your current Side</div>
                </>
              )}
            </div>
          </button>

          {side === "public" ? (
            <button
              type="button"
              onClick={onQuoteEcho}
              className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
            >
              <div className={cn("w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm", theme.text)}>
                <PenLine size={20} />
              </div>
              <div>
                <div className="font-bold text-gray-900">Quote Echo</div>
                <div className="text-xs text-gray-500">Add your thoughts</div>
              </div>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onShareExternal}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-sm">
              <Share2 size={20} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Share Externally</div>
              <div className="text-xs text-gray-500">Copy link or share to other apps</div>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
EOF

echo "Patching PostCard.tsx + siddes-post/[id]/page.tsx + backend quote-echo gates..."
node - <<'NODE'
const fs = require("fs");
const path = require("path");

function read(p){ return fs.readFileSync(p, "utf8"); }
function write(p, s){ fs.writeFileSync(p, s, "utf8"); }
function die(msg){ console.error("ERROR:", msg); process.exit(1); }

function patchFile(rel, transform){
  const p = path.join(process.cwd(), rel);
  const before = read(p);
  const after = transform(before);
  if (after === before) die(`No changes applied to ${rel} (pattern mismatch).`);
  write(p, after);
  console.log("OK: patched", rel);
}

patchFile("frontend/src/components/PostCard.tsx", (txt) => {
  // 1) Replace submitQuoteEcho function with a safe version that returns {ok,message}
  const reFunc = /const submitQuoteEcho = async \(text: string\) => \{[\s\S]*?\n\s*\};\n\n\s*const openPost/s;
  const newFunc =
`const submitQuoteEcho = async (text: string): Promise<{ ok: boolean; message?: string }> => {
    const t = String(text || "").trim();
    if (!t) return { ok: false, message: "Write something first." };
    if (echoBusy) return { ok: false, message: "Still working — try again." };

    const maxLen = side === "public" ? 800 : 5000;
    if (t.length > maxLen) return { ok: false, message: \`Too long. Max \${maxLen} characters.\` };

    setEchoBusy(true);
    try {
      const res = await fetch(\`/api/post/\${encodeURIComponent(post.id)}/quote\`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t, side, client_key: \`quote_\${Date.now().toString(36)}\` }),
      });
      const j = await res.json().catch(() => null);

      if (res.ok && j && j.ok === true) {
        toast.success("Quote Echoed.");
        // A quote echo is also an echo (state-wise) in this Side.
        setEchoed(true);
        setEchoCount((c) => c + 1);
        try {
          router.refresh();
        } catch {
          // ignore
        }
        return { ok: true };
      }

      const code = j && typeof j.error === "string" ? j.error : "request_failed";

      if (res.status === 400) {
        if (code === "too_long" && j && typeof j.max === "number") return { ok: false, message: \`Too long. Max \${j.max} characters.\` };
        if (code === "empty_text") return { ok: false, message: "Write something first." };
        return { ok: false, message: "Couldn’t quote echo — check your text." };
      }

      if (res.status === 401) return { ok: false, message: "Login required." };

      if (res.status === 403) {
        if (code === "echo_forbidden_private") return { ok: false, message: "Quote Echo is available for Public posts only." };
        if (code === "public_trust_low" && j && typeof j.min_trust === "number") return { ok: false, message: \`Public quote echo requires Trust L\${j.min_trust}+.\` };
        if (code === "rate_limited" && j && typeof j.retry_after_ms === "number") {
          const sec = Math.max(1, Math.round(Number(j.retry_after_ms) / 1000));
          return { ok: false, message: \`Slow down — try again in \${sec}s.\` };
        }
        return { ok: false, message: "Restricted: you can’t quote echo here." };
      }

      if (res.status === 404) return { ok: false, message: "Post not found." };
      if (res.status >= 500) return { ok: false, message: "Server error — try again." };

      return { ok: false, message: "Couldn’t quote echo — try again." };
    } catch {
      return { ok: false, message: "Network error — try again." };
    } finally {
      setEchoBusy(false);
    }
  };`;

  if (!reFunc.test(txt)) die("PostCard.tsx: submitQuoteEcho block not found.");
  txt = txt.replace(reFunc, `${newFunc}\n\n  const openPost`);

  // 2) Replace QuoteEchoComposer usage to NOT close before submit, and pass busy
  const reComposer = /<QuoteEchoComposer[\s\S]*?onSubmit=\{async \(text\) => \{\s*setOpenQuote\(false\);\s*await submitQuoteEcho\(text\);\s*\}\}[\s\S]*?\/>\s*/m;
  const newComposer =
`<QuoteEchoComposer
        open={openQuote}
        onClose={() => setOpenQuote(false)}
        post={post}
        side={side}
        busy={echoBusy}
        onSubmit={submitQuoteEcho}
      />\n\n`;
  if (!reComposer.test(txt)) die("PostCard.tsx: QuoteEchoComposer block not found.");
  txt = txt.replace(reComposer, newComposer);

  return txt;
});

patchFile("frontend/src/app/siddes-post/[id]/page.tsx", (txt) => {
  // 0) Add ReplySendError type after StoredReply
  const reTypeAnchor = /type StoredReply = [^\n]+\n\nfunction cn/;
  if (!reTypeAnchor.test(txt)) die("siddes-post/[id]/page.tsx: StoredReply anchor not found.");
  txt = txt.replace(reTypeAnchor, (m) => {
    return m.replace("\n\nfunction cn", "\n\ntype ReplySendError = { kind: \"validation\" | \"restricted\" | \"network\" | \"server\" | \"unknown\"; message: string };\n\nfunction cn");
  });

  // 1) Add replyBusy/replyError state + reset effect
  const reState = /const \[replyOpen, setReplyOpen\] = useState\(false\);\n  const \[queuedCount, setQueuedCount\] = useState\(0\);/;
  if (!reState.test(txt)) die("siddes-post/[id]/page.tsx: replyOpen/queuedCount state block not found.");
  txt = txt.replace(reState,
`const [replyOpen, setReplyOpen] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<ReplySendError | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    if (!replyOpen) return;
    setReplyBusy(false);
    setReplyError(null);
  }, [replyOpen]);`
  );

  // 2) Replace ReplyComposer block with safe handler + props
  const reReplyBlock = /<ReplyComposer[\s\S]*?onSend=\{async \(text\) => \{[\s\S]*?\}\}\s*\/>\s*/m;
  if (!reReplyBlock.test(txt)) die("siddes-post/[id]/page.tsx: ReplyComposer block not found.");

  const newReplyBlock =
`<ReplyComposer
        open={replyOpen}
        onClose={() => {
          setReplyOpen(false);
          setReplyBusy(false);
          setReplyError(null);
        }}
        post={found.post}
        side={found.side}
        busy={replyBusy}
        error={replyError}
        maxLen={2000}
        onSend={async (text) => {
          const t = String(text || "").trim();
          if (!t) {
            setReplyError({ kind: "validation", message: "Write something first." });
            return;
          }

          if (t.length > 2000) {
            setReplyError({ kind: "validation", message: "Too long. Max 2000 characters." });
            return;
          }

          if (replyBusy) return;
          setReplyBusy(true);
          setReplyError(null);

          const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;

          // Offline: queue and close (undo).
          if (!onlineNow) {
            const queued = enqueueReply(found.side, found.post.id, t);
            setReplyOpen(false);
            setReplyBusy(false);
            toast.undo("Reply queued (offline).", () => removeQueuedItem(queued.id));
            return;
          }

          try {
            const res = await fetch(\`/api/post/\${encodeURIComponent(found.post.id)}/reply\`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ text: t, client_key: \`reply_\${Date.now().toString(36)}\` }),
            });

            if (res.ok) {
              const data = await res.json().catch(() => null);
              if (!data || data.ok !== false) {
                setReplyOpen(false);
                setReplyBusy(false);
                toast.success("Reply sent.");
                return;
              }
            }

            const j = await res.json().catch(() => null);
            const code = j && typeof j.error === "string" ? j.error : "request_failed";

            if (res.status === 400) {
              if (code === "too_long" && j && typeof j.max === "number") {
                setReplyError({ kind: "validation", message: \`Too long. Max \${j.max} characters.\` });
              } else if (code === "empty_text") {
                setReplyError({ kind: "validation", message: "Write something first." });
              } else {
                setReplyError({ kind: "validation", message: "Couldn’t send — check your reply." });
              }
              setReplyBusy(false);
              return;
            }

            if (res.status === 401) {
              setReplyError({ kind: "restricted", message: "Login required to reply." });
              setReplyBusy(false);
              return;
            }

            if (res.status === 403) {
              const hint = j && typeof j.error === "string" ? String(j.error) : "restricted";
              if (hint === "public_trust_low" && j && typeof j.min_trust === "number") {
                setReplyError({ kind: "restricted", message: \`Public replies require Trust L\${j.min_trust}+.\` });
              } else if (hint === "rate_limited" && j && typeof j.retry_after_ms === "number") {
                const sec = Math.max(1, Math.round(Number(j.retry_after_ms) / 1000));
                setReplyError({ kind: "restricted", message: \`Slow down — try again in \${sec}s.\` });
              } else {
                setReplyError({ kind: "restricted", message: "Restricted: you can’t reply here." });
              }
              setReplyBusy(false);
              return;
            }

            if (res.status >= 500) {
              setReplyError({ kind: "server", message: "Server error — reply not sent. Try again." });
              setReplyBusy(false);
              return;
            }

            setReplyError({ kind: "unknown", message: "Couldn’t send reply — try again." });
            setReplyBusy(false);
            return;
          } catch {
            setReplyError({ kind: "network", message: "Network error — reply not sent. Try again." });
            setReplyBusy(false);
            return;
          }
        }}
      />`;

  txt = txt.replace(reReplyBlock, newReplyBlock + "\n\n");

  return txt;
});

patchFile("backend/siddes_post/views.py", (txt) => {
  const needle =
`        tgt = str(body.get("side") or "public").strip().lower()
        if tgt not in _ALLOWED_SIDES:
            tgt = "public"

        client_key = str(body.get("client_key") or body.get("clientKey") or "").strip() or None`;
  if (!txt.includes(needle)) die("backend/siddes_post/views.py: QuoteEcho target-side block not found.");

  const insert =
`        tgt = str(body.get("side") or "public").strip().lower()
        if tgt not in _ALLOWED_SIDES:
            tgt = "public"

        # sd_385: align quote-echo write gates with PostCreate (length + trust gates)
        max_len = 800 if tgt == "public" else 5000
        if len(text) > max_len:
            return Response({"ok": False, "error": "too_long", "max": max_len}, status=status.HTTP_400_BAD_REQUEST)

        if trust_gates_enabled() and tgt == "public":
            trust = _trust_level(request, role=role)
            gate = enforce_public_write_gates(viewer_id=viewer, trust_level=trust, text=text, kind="post")
            if not gate.get("ok"):
                st = int(gate.get("status") or 403)
                payload: Dict[str, Any] = {"ok": False, "restricted": st == 401, "error": gate.get("error")}
                if gate.get("retry_after_ms") is not None:
                    payload["retry_after_ms"] = gate.get("retry_after_ms")
                if gate.get("min_trust") is not None:
                    payload["min_trust"] = gate.get("min_trust")
                return Response(payload, status=st)

        client_key = str(body.get("client_key") or body.get("clientKey") or "").strip() or None`;

  return txt.replace(needle, insert);
});
NODE

echo "Writing docs/COMPOSER_REPLY_QUOTE_SAFETY_V1.md ..."
mkdir -p "$ROOT/docs"
cat > "$ROOT/docs/COMPOSER_REPLY_QUOTE_SAFETY_V1.md" <<'DOC'
# Siddes Composer Parity: Reply + Quote Echo (sd_385)

## Goal
Bring Reply and Quote Echo flows up to the same safety bar as `/siddes-compose`:

- Never destroy user text on failure.
- Queue only when offline.
- Enforce client-side limits that match backend.
- Inline error on failure (no silent close, no fake success).

## Behavior Contract

### Reply
- Max length: **2000**.
- Offline: queue reply + undo + close is OK.
- Online failure: keep composer open, keep text, show inline error.
- Trust gates (Public): show inline restricted message (Trust Lx / rate limit).

### Quote Echo
- Max length: **800 (Public target)** / **5000 (private target)**.
- Never close before backend success.
- Inline error; preserve text.
- UI only shows Quote Echo action for **Public posts** (matches current backend launch-safe rule).

## Backend alignment
`PostQuoteEchoView` now enforces:
- max length (same as PostCreate: 800/5000)
- Public trust gates (same policy path as PostCreate)

## Files touched
- frontend/src/components/ReplyComposer.tsx
- frontend/src/app/siddes-post/[id]/page.tsx
- frontend/src/components/QuoteEchoComposer.tsx
- frontend/src/components/PostCard.tsx
- frontend/src/components/EchoSheet.tsx
- backend/siddes_post/views.py

## Manual QA
1) Open a post detail, click **Add reply**
   - type > 2000 chars → send disabled + red counter
   - simulate backend error → composer stays open, text remains
2) Go offline → send reply → queued + undo, composer closes
3) Public post → Echo sheet shows **Quote Echo**
   - type too long → inline error, stays open
   - backend error → inline error, stays open
4) Non-public post → Echo sheet does **not** show Quote Echo
DOC

echo ""
echo "✅ sd_385 applied."
echo ""
echo "Next (VS Code terminal):"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo ""
echo "Verify:"
echo "  - Open /siddes-post/<id> and test replies (offline + online failure)."
echo "  - Open Echo sheet on a PUBLIC post and test Quote Echo failure preservation."
echo ""
echo "Rollback:"
echo "  cp \"$BK/frontend/src/components/ReplyComposer.tsx\" \"$ROOT/frontend/src/components/ReplyComposer.tsx\""
echo "  cp \"$BK/frontend/src/components/QuoteEchoComposer.tsx\" \"$ROOT/frontend/src/components/QuoteEchoComposer.tsx\""
echo "  cp \"$BK/frontend/src/components/EchoSheet.tsx\" \"$ROOT/frontend/src/components/EchoSheet.tsx\""
echo "  cp \"$BK/frontend/src/components/PostCard.tsx\" \"$ROOT/frontend/src/components/PostCard.tsx\""
echo "  cp \"$BK/frontend/src/app/siddes-post/[id]/page.tsx\" \"$ROOT/frontend/src/app/siddes-post/[id]/page.tsx\""
echo "  cp \"$BK/backend/siddes_post/views.py\" \"$ROOT/backend/siddes_post/views.py\""
