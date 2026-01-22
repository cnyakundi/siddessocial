"use client";

import React, { useMemo } from "react";
import type { SideId } from "@/src/lib/sides";
import type { SetDef } from "@/src/lib/sets";
import { computeComposeSuggestions } from "@/src/lib/composeIntent";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function ComposeSuggestionBar({
  text,
  currentSide,
  sets,
  selectedSetId,
  urgent,
  onApplySide,
  onToggleSet,
  onToggleUrgent,
}: {
  text: string;
  currentSide: SideId;
  sets: SetDef[];
  selectedSetId: string | null;
  urgent: boolean;
  onApplySide: (side: SideId) => void;
  onToggleSet: (setId: string) => void;
  onToggleUrgent: () => void;
}) {
  const suggestions = useMemo(() => {
    return computeComposeSuggestions({ text, currentSide, sets, selectedSetId, urgent });
  }, [text, currentSide, sets, selectedSetId, urgent]);

  if (!suggestions.length) return null;

  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
        Suggested
      </div>

      <div className="flex gap-2 flex-wrap">
        {suggestions.map((s) => {
          if (s.kind === "side") {
            const t = SIDE_THEMES[s.side];
            return (
              <button
                key={`side:${s.side}`}
                type="button"
                onClick={() => onApplySide(s.side)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                  t.lightBg,
                  t.border,
                  t.text,
                  "hover:opacity-90"
                )}
              >
                {SIDES[s.side].label}
              </button>
            );
          }

          if (s.kind === "set") {
            const active = selectedSetId === s.setId;
            return (
              <button
                key={`set:${s.setId}`}
                type="button"
                onClick={() => onToggleSet(s.setId)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90",
                  active
                    ? "bg-orange-100 text-orange-800 border-orange-200"
                    : "bg-orange-50 text-orange-700 border-orange-100"
                )}
              >
                {s.label}
              </button>
            );
          }

          // urgent
          return (
            <button
              key="urgent"
              type="button"
              onClick={onToggleUrgent}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90",
                urgent
                  ? "bg-red-100 text-red-800 border-red-200"
                  : "bg-red-50 text-red-700 border-red-100"
              )}
            >
              Urgent
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-gray-400 mt-2">
        Tap to apply. Suggestions never auto-switch.
      </div>
    </div>
  );
}
