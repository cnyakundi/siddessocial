"use client";

import React, { useMemo } from "react";
import type { SideId } from "@/src/lib/sides";
import type { SetDef } from "@/src/lib/sets";
import { computeComposeSuggestions } from "@/src/lib/composeIntent";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * ComposeSuggestionBar (sd_820)
 * - Minimal suggestion UI (no auto actions).
 * - MUST be wired to computeComposeSuggestions (compose_intent_check).
 * - No internal '' / confidence leakage.
 */
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
      <div className="text-[11px] font-black text-gray-400 uppercase tracking-[0.22em] mb-2">Suggested</div>

      <div className="flex gap-2 flex-wrap">
        {suggestions.map((s) => {
          if (s.kind === "side") {
            const t = SIDE_THEMES[s.side];
            const active = s.side === currentSide;
            return (
              <button
                key={`side:${s.side}`}
                type="button"
                onClick={() => onApplySide(s.side)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-black border transition-colors",
                  active ? cn(t.primaryBg, "text-white border-transparent") : cn(t.lightBg, t.border, t.text),
                  "hover:opacity-90"
                )}
                aria-label={`Switch to ${SIDES[s.side]?.label || s.side}`}
              >
                {SIDES[s.side]?.label || s.side}
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
                  "px-3 py-1.5 rounded-full text-xs font-black border transition-colors",
                  active ? "bg-gray-900 text-white border-transparent" : "bg-white text-gray-800 border-gray-200",
                  "hover:bg-gray-50"
                )}
                aria-label={`Toggle group ${s.label}`}
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
                "px-3 py-1.5 rounded-full text-xs font-black border transition-colors",
                urgent ? "bg-rose-600 text-white border-transparent" : "bg-rose-50 text-rose-700 border-rose-200",
                "hover:opacity-90"
              )}
              aria-label={urgent ? "Unmark urgent" : "Mark urgent"}
            >
              {urgent ? "Urgent ✓" : "Mark urgent"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

