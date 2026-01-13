"use client";

import React, { useMemo } from "react";
import type { MentionCandidate } from "@/src/lib/mockPeople";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function MentionPicker({
  open,
  query,
  items,
  onPick,
}: {
  open: boolean;
  query: string;
  items: MentionCandidate[];
  onPick: (handle: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.handle.toLowerCase().includes(q));
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="absolute bottom-14 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
      <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
        Mention
      </div>
      {filtered.slice(0, 6).map((m) => (
        <button
          key={m.handle}
          type="button"
          className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
          onClick={() => onPick(m.handle)}
        >
          <div className="text-sm font-semibold text-gray-900">{m.name}</div>
          <div className="text-xs text-gray-500">{m.handle}</div>
        </button>
      ))}
      {!filtered.length ? (
        <div className="px-4 py-4 text-sm text-gray-400">No matches.</div>
      ) : null}
    </div>
  );
}
