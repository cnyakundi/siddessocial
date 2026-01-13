"use client";

import React, { useRef } from "react";
import { Lock } from "lucide-react";
import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import { useSide } from "@/src/components/SideProvider";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function SideBadge({
  sideId,
  onClick,
  onLongPress,
  longPressMs = 500,
  className,
  showLock = true,
}: {
  sideId?: SideId;
  onClick?: () => void;
  onLongPress?: () => void;
  longPressMs?: number;
  className?: string;
  showLock?: boolean;
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
        "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-150 active:scale-95 select-none",
        theme.border,
        theme.lightBg,
        className
      )}
      aria-label={`Current Side: ${meta.label}`}
    >
      <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} />
      <span className={cn("text-sm font-bold", theme.text)}>{meta.label}</span>
      {showLock && meta.isPrivate ? (
        <Lock size={12} className={cn("opacity-60", theme.text)} />
      ) : null}
    </button>
  );
}
