"use client";

import React, { useMemo } from "react";
import type { SideId } from "@/src/lib/sides";
import type { SetDef } from "@/src/lib/sets";
import { computeComposeSuggestions } from "@/src/lib/composeIntent";
import { SIDE_THEMES } from "@/src/lib/sides";

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
      <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">
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
                  "px-3 py-1.5 rounded-full text-xs font-extrabold border transition-colors",
                  t.lightBg,
                  t.border,
                  t.text,
                  "hover:opacity-90"
                )}
                title={`Why: ${s.reason} • ${(s.confidence * 100).toFixed(0)}%`}
              >
                Switch to {s.side}
              </button>
            );
          }

          if (s.kind === "urgent") {
            return (
              <button
                key="urgent"
                type="button"
                onClick={() => onToggleUrgent()}
                className="px-3 py-1.5 rounded-full text-xs font-extrabold border border-gray-200 bg-gray-900 text-white hover:opacity-90"
                title={`Why: ${s.reason} • ${(s.confidence * 100).toFixed(0)}%`}
              >
                Mark urgent
              </button>
            );
          }

          // set
          return (
            <button
              key={`set:${s.setId}`}
              type="button"
              onClick={() => onToggleSet(s.setId)}
              className="px-3 py-1.5 rounded-full text-xs font-extrabold border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              title={`Why: ${s.reason} • ${(s.confidence * 100).toFixed(0)}%`}
            >
              Set: {s.label}
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-gray-400 mt-2">
        Suggestions are optional — nothing changes unless you tap.
      </div>
    </div>
  );
}
