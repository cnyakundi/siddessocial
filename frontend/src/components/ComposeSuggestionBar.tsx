"use client";

import React, { useMemo } from "react";
import type { SideId } from "@/src/lib/sides";
import type { SetDef } from "@/src/lib/sets";

/**
 * ComposeSuggestionBar (minimal, check-compliant, safe default)
 * - Suggest-only UI (never posts automatically)
 * - Can be wired behind flags / advanced mode by caller
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
  onApplySide: (s: SideId) => void;
  onToggleSet: (id: string) => void;
  onToggleUrgent: () => void;
}) {
  const t = String(text || "").trim();

  const suggestions = useMemo(() => {
    // VERY light heuristics; this is a UI bar, not a brain.
    const out: Array<{ id: string; label: string; kind: "side" | "urgent" | "set"; value: any; desc: string }> = [];

    if (!t) return out;

    // Work-ish language -> suggest Work
    const worky =
      /\b(standup|meeting|slides|deck|deadline|eod|pr|deploy|prod|bug|ticket|jira|client|contract|invoice)\b/i.test(t);

    if (worky && currentSide !== "work") {
      out.push({ id: "side_work", kind: "side", value: "work", label: "Switch to Work", desc: "Looks like work context." });
    }

    // Private / intimate words -> suggest Close
    const closey = /\b(family|mom|dad|wife|husband|kids|home|baby|love you)\b/i.test(t);
    if (closey && currentSide !== "close") {
      out.push({ id: "side_close", kind: "side", value: "close", label: "Switch to Close", desc: "Looks personal." });
    }

    // Urgent cue
    const urgentCue = /\b(urgent|asap|now|immediately|critical)\b/i.test(t);
    if (urgentCue && !urgent) {
      out.push({ id: "urgent", kind: "urgent", value: true, label: "Mark Urgent", desc: "Contains urgency cue." });
    }

    // If sets exist for this side and none selected, suggest the first one (gentle default)
    if (!selectedSetId && Array.isArray(sets) && sets.length) {
      const first = sets.find((s) => (s as any)?.side === currentSide) || sets[0];
      if (first?.id) out.push({ id: "set_first", kind: "set", value: String(first.id), label: `Set: ${first.label}`, desc: "Optional context." });
    }

    return out.slice(0, 3);
  }, [t, currentSide, urgent, selectedSetId, sets]);

  if (!suggestions.length) return null;

  return (
    <div className="mt-2">
      <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Suggestions</div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (s.kind === "side") onApplySide(s.value as SideId);
              else if (s.kind === "urgent") onToggleUrgent();
              else if (s.kind === "set") onToggleSet(String(s.value));
            }}
            className="px-3 py-2 rounded-full border border-gray-200 bg-white text-xs font-extrabold text-gray-800 hover:bg-gray-50"
            title={s.desc}
            aria-label={s.label}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-gray-400 mt-2">Suggestions are optional — nothing changes unless you tap.</div>
    </div>
  );
}
