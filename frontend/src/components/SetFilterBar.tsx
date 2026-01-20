"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { SetDef, SetId } from "@/src/lib/sets";
import { getSetTheme } from "@/src/lib/setThemes";
import { SetPickerSheet } from "@/src/components/SetPickerSheet";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function SetFilterBar({
  sets,
  activeSet,
  onSetChange,
  onNewSet,
  label = "Set",
  allLabel = "All",
}: {
  sets: SetDef[];
  activeSet: SetId | null;
  onSetChange: (next: SetId | null) => void;
  onNewSet?: () => void;
  label?: string;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const active = useMemo(() => sets.find((s) => s.id === activeSet) ?? null, [sets, activeSet]);

  const dotClass = useMemo(() => {
    if (!active) return "bg-gray-300";
    const theme = getSetTheme(active.color);
    return theme.bg;
  }, [active]);

  const title = active ? active.label : allLabel;

  return (
    <>
      <div className="flex items-center justify-between gap-3" data-testid="set-filter-bar">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-1 text-left p-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-between gap-3"
          aria-label={`${label}: ${title}`}
        >
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</div>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <span className={cn("w-2.5 h-2.5 rounded-full", dotClass)} />
              <span className="text-sm font-bold text-gray-900 truncate">{title}</span>
              {active?.members?.length ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                  {active.members.length}
                </span>
              ) : null}
            </div>
          </div>

          <ChevronDown size={18} className="text-gray-500" />
        </button>

        {onNewSet ? (
          <button
            type="button"
            onClick={onNewSet}
            className="px-4 py-3 rounded-2xl border border-dashed border-gray-300 text-gray-700 text-sm font-bold hover:border-gray-400 hover:bg-gray-50 inline-flex items-center gap-2"
            aria-label="New Set"
          >
            <Plus size={16} />
            New
          </button>
        ) : null}
      </div>

      <SetPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        sets={sets}
        activeSet={activeSet}
        onPick={onSetChange}
        onNewSet={onNewSet}
        title="Choose Set"
        allLabel={allLabel}
      />
    </>
  );
}
