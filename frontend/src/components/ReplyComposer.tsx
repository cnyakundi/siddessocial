"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
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

  useLockBodyScroll(open && Boolean(post));

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
        onPointerDown={(e) => {
        // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click)
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
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
