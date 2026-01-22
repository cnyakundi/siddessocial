"use client";

import React from "react";
import { Plus } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * sd_490: Desktop Endgame skin.
 * - Mobile: stays light + compact.
 * - Desktop: becomes a real "Composer Card" visually (but still just opens /siddes-compose — no fake posting).
 */
export function FeedComposerRow(props: { side: SideId; prompt: string; subtitle?: string; onOpen: () => void }) {
  const { side, prompt, subtitle, onOpen } = props;
  const theme = SIDE_THEMES[side];
  const isWork = side === "work";

  const desktopPad = isWork ? "lg:p-6" : "lg:p-8";

  return (
    <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-50 lg:px-0 lg:pt-8 lg:pb-8 lg:bg-transparent lg:border-b-0">
      <div className="max-w-[760px] mx-auto">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "w-full text-left flex items-center gap-4 lg:gap-6 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all active:scale-[0.99]",
            "bg-gray-50/40 hover:bg-gray-50",
            "lg:bg-white lg:hover:bg-white",
            "hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)]",
            "p-5",
            desktopPad
          )}
          aria-label="Write a post"
        >
          {/* Avatar (ME) */}
          <div
            className={cn(
              "w-11 h-11 lg:w-14 lg:h-14 rounded-2xl lg:rounded-full border flex items-center justify-center text-[11px] lg:text-sm font-black shrink-0",
              theme.lightBg,
              theme.text,
              theme.border
            )}
            aria-hidden="true"
            title="You"
          >
            ME
          </div>

          {/* Prompt */}
          <div className="flex-1 min-w-0">
            <div className="text-[15px] lg:text-[20px] text-gray-800 font-bold truncate">{prompt}</div>
            {subtitle ? (
              <div className="text-[10px] lg:text-[12px] text-gray-400 font-black uppercase tracking-widest mt-1 truncate">
                {subtitle}
              </div>
            ) : null}
          </div>

          {/* CTA */}
          <div className="ml-auto shrink-0 flex items-center">
            {/* Desktop pill */}
            <div
              className={cn(
                "hidden lg:inline-flex items-center gap-2 px-10 py-3 rounded-2xl text-white text-[14px] font-bold shadow-xl",
                theme.primaryBg
              )}
              aria-hidden="true"
            >
              <Plus size={20} strokeWidth={2.5} />
              New Post
            </div>

            {/* Mobile square */}
            <div
              className={cn(
                "lg:hidden w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg",
                theme.primaryBg
              )}
              aria-hidden="true"
            >
              <Plus size={22} strokeWidth={3} />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
