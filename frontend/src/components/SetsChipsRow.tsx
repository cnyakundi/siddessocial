"use client";

import React from "react";
import { Plus } from "lucide-react";
import type { SetDef, SetId } from "@/src/lib/sets";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function SetsChipsRow({
  sets,
  activeSet,
  onSetChange,
  onNewSet,
}: {
  sets: SetDef[];
  activeSet: SetId | null;
  onSetChange: (next: SetId | null) => void;
  onNewSet: () => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
      <button
        type="button"
        onClick={() => onSetChange(null)}
        className={cn(
          "px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
          !activeSet ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        )}
      >
        All
      </button>

      {sets.map((s) => {
        const active = activeSet === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSetChange(active ? null : s.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-1",
              active ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {s.label}
            {s.count > 0 ? (
              <span
                className={cn(
                  "ml-1 text-[10px] px-1.5 rounded-full",
                  active ? "bg-white/20" : "bg-gray-200 text-gray-600"
                )}
              >
                {s.count}
              </span>
            ) : null}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onNewSet}
        className="px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:border-emerald-300 hover:text-emerald-700 inline-flex items-center gap-1"
      >
        <Plus size={14} />
        New Circle
      </button>
    </div>
  );
}
