"use client";

import React from "react";
import { Lock } from "lucide-react";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function CirclesJoinedPill({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "px-2 py-0.5 rounded-full text-[11px] font-black border bg-slate-50 text-slate-800 border-slate-200 flex items-center gap-1",
        className
      )}
    >
      <Lock size={12} className="text-slate-500" />
      Joined
    </div>
  );
}

export function CirclesJoinedBanner({ viewer }: { viewer: string }) {
  return (
    <div className="mb-3 p-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm">
      <div className="flex items-center gap-2 font-bold mb-1">
        <CirclesJoinedPill />
        <div className="min-w-0 truncate">
          Viewing as <span className="font-mono">{viewer}</span> — read-only
        </div>
      </div>
      <div className="text-xs leading-relaxed text-slate-600">
        You can view this Circle and its history. Only the owner can edit or send invites.
      </div>
    </div>
  );
}
