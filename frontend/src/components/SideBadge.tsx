"use client";

import React, { useRef } from "react";
import { Lock, ChevronDown } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { useSide } from "@/src/components/SideProvider";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * sd_494: Mobile v1.3 SideBadge (Threshold Pill)
 * - Height: 44px (h-11)
 * - Dot: 8px (w-2 h-2)
 * - Typography: 10px BLACK, caps, tracking-[0.15em]
 * - Deterministic: shows lock for private sides only (no fake signals)
 */
export function SideBadge({
  sideId,
  onClick,
  onLongPress,
  longPressMs = 500,
  className,
  showLock = true,
  showChevron = true,
}: {
  sideId?: SideId;
  onClick?: () => void;
  onLongPress?: () => void;
  longPressMs?: number;
  className?: string;
  showLock?: boolean;
  showChevron?: boolean;
}) {
  const { side } = useSide();
  const s = sideId ?? side;
  const meta = SIDES[s];
  const theme = SIDE_THEMES[s];

  const timerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);

  const start = () => {
    if (!onLongPress) return;
    didLongPressRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      onLongPress();
    }, longPressMs);
  };

  const end = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = () => {
    // If long-press fired, swallow the click to avoid double actions
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={start}
      onTouchEnd={end}
      className={cn(
        "flex items-center gap-2 h-11 px-5 rounded-full border shadow-sm transition-colors duration-150 active:scale-95 select-none",
        theme.border,
        theme.lightBg,
        className
      )}
      aria-label={`Current Side: ${meta.label}`}
      title={showChevron ? "Switch room" : "Current room"}
    >
      <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />
      <span className={cn("text-[10px] font-black uppercase tracking-[0.15em]", theme.text)}>{meta.label} Side</span>
      {showLock && meta.isPrivate ? <Lock size={14} strokeWidth={2.5} className={cn("opacity-60", theme.text)} /> : null}
      {showChevron ? <ChevronDown size={14} strokeWidth={2.5} className={cn("opacity-60", theme.text)} /> : null}
    </button>
  );
}
