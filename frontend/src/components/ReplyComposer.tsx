"use client";

import React, { useEffect, useState } from "react";
import { X, Send } from "lucide-react";
import type { FeedPost } from "@/src/lib/mockFeed";

export function ReplyComposer({
  open,
  onClose,
  post,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  post: FeedPost | null;
  onSend: (text: string) => void;
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

  if (!open || !post) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close reply composer"
      />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-gray-900">Reply</div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-3 rounded-2xl border border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 mb-1">Replying to</div>
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
            onClick={() => onSend(text.trim())}
            className="px-5 py-2 rounded-full bg-gray-900 text-white font-bold hover:opacity-90 inline-flex items-center gap-2"
            disabled={!text.trim()}
          >
            <Send size={16} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
