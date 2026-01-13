"use client";

import React, { useEffect } from "react";
import { Repeat, PenLine, Share2, X } from "lucide-react";
import type { FeedPost } from "@/src/lib/mockFeed";

export function EchoSheet({
  open,
  onClose,
  post,
  onEcho,
  onQuoteEcho,
  onShareExternal,
}: {
  open: boolean;
  onClose: () => void;
  post: FeedPost | null;
  onEcho: () => void;
  onQuoteEcho: () => void;
  onShareExternal: () => void;
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
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-green-600 shadow-sm">
              <Repeat size={20} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Echo</div>
              <div className="text-xs text-gray-500">Instantly share to your current Side</div>
            </div>
          </button>

          <button
            type="button"
            onClick={onQuoteEcho}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm">
              <PenLine size={20} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Quote Echo</div>
              <div className="text-xs text-gray-500">Add your thoughts</div>
            </div>
          </button>

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
