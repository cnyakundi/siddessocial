"use client";

import React from "react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function FeedComposerRow(props: { side: SideId; prompt: string; subtitle?: string; onOpen: () => void }) {
  const { side, prompt, subtitle, onOpen } = props;
  const theme = SIDE_THEMES[side];

  return (
    <div className="p-4 border-b border-gray-100 bg-white">
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center gap-4 p-3 bg-gray-50 border border-gray-100 rounded-2xl text-left transition-colors active:bg-gray-100"
        aria-label="Write a post"
      >
        <div
          className={cn(
            "w-10 h-10 rounded-full border flex items-center justify-center text-[11px] font-black shrink-0",
            theme.lightBg,
            theme.text,
            theme.border
          )}
          aria-hidden="true"
        >
          ME
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-700 font-medium truncate">{prompt}</div>
          {subtitle ? (
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 truncate">{subtitle}</div>
          ) : null}
        </div>

        <div className={cn("px-4 py-2 rounded-xl text-xs font-black text-white shadow-sm", theme.primaryBg)}>Write</div>
      </button>
    </div>
  );
}
