"use client";

import React from "react";
import { Bookmark } from "lucide-react";
import type { PinnedStackItem } from "@/src/lib/mockUsers";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function PinnedStack({
  items,
  className,
}: {
  items: PinnedStackItem[];
  className?: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className={cn("mb-4", className)}>
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 inline-flex items-center gap-2">
            <Bookmark size={12} className="text-gray-400" />
            Start Here
          </div>
          <div className="text-sm text-gray-700">Pinned Stack</div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {items.map((it) => (
          <div
            key={it.id}
            className="min-w-[220px] max-w-[260px] p-3 rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="font-bold text-gray-900 text-sm leading-snug">{it.title}</div>
            {it.subtitle ? (
              <div className="text-xs text-gray-500 mt-0.5">{it.subtitle}</div>
            ) : null}
            {it.body ? (
              <div className="text-xs text-gray-700 mt-2 leading-relaxed">{it.body}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
