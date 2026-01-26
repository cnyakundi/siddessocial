"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);


  if (!open || !post || !mounted) return null;

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

  return createPortal(
    <div className="fixed inset-0 z-[98] flex items-end justify-center md:items-center">
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
    , document.body
  );
}
