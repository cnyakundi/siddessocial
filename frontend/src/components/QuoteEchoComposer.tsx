"use client";

import React, { useEffect, useState } from "react";
import { X, Repeat } from "lucide-react";
import type { FeedPost } from "@/src/lib/mockFeed";

export function QuoteEchoComposer({
  open,
  onClose,
  post,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  post: FeedPost | null;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) return;
    setText("");
  }, [open]);

  if (!open || !post) return null;

  return (
    <div className="fixed inset-0 z-[98] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close quote echo composer"
      />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-gray-900">Quote Echo</div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
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
            onClick={() => onSubmit(text)}
            className="px-5 py-2 rounded-full bg-gray-900 text-white font-bold hover:opacity-90 inline-flex items-center gap-2"
          >
            <Repeat size={16} />
            Echo
          </button>
        </div>
      </div>
    </div>
  );
}
