"use client";

import React, { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import { MOCK_POSTS } from "@/src/lib/mockFeed";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function excerpt(s: string, n = 90) {
  const t = (s || "").trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

export function PeekSheet({ open, onClose, sideId }: { open: boolean; onClose: () => void; sideId: SideId }) {
  const router = useRouter();
  const theme = SIDE_THEMES[sideId];
  const meta = SIDES[sideId];

  const items = useMemo(() => {
    const posts = MOCK_POSTS[sideId] ?? [];
    return posts.slice(0, 2);
  }, [sideId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-label="Close peek" />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("font-bold", theme.text)}>Peeking into {meta.label}</div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {items.length ? (
            items.map((p) => (
              <div key={p.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span className="font-bold text-gray-700">{p.author}</span>
                  <span>{p.time}</span>
                </div>
                <div className="text-sm text-gray-800">“{excerpt(p.content)}”</div>
                <button type="button" className={cn("mt-2 text-xs font-bold", theme.text, "hover:underline")} onClick={() => router.push(`/siddes-post/${p.id}?reply=1`)}>
                  Reply
                </button>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-400">Nothing new here yet.</div>
          )}
        </div>

        <button type="button" onClick={onClose} className="w-full py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
          Close Peek
        </button>
      </div>
    </div>
  );
}
