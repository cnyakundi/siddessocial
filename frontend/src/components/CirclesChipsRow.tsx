"use client";

import React, { useMemo } from "react";
import { Circle as CircleIcon, Plus } from "lucide-react";

import type { CircleDef, CircleId } from "@/src/lib/circles";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function labelOf(c: any): string {
  const a = String(c?.label || "").trim();
  if (a) return a;
  const b = String(c?.name || "").trim();
  if (b) return b;
  return "Circle";
}

/**
 * CirclesChipsRow — Design Canon v1
 * - Neutral, minimal chips; active is BLACK (not side-colored).
 * - Public usually hides circles upstream; this component stays generic.
 */
export function CirclesChipsRow(props: {
  circles: CircleDef[];
  activeCircle: CircleId | null;
  onPick: (next: CircleId | null) => void;
  onCreate?: () => void;
}) {
  const { circles, activeCircle, onPick, onCreate } = props;
  const list = useMemo(() => (Array.isArray(circles) ? circles : []), [circles]);

  // Still render if "New" is present (so user can create the first circle).
  if (!list.length && !onCreate) return null;

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
      <button
        type="button"
        onClick={() => onPick(null)}
        className={cn(
          "flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition-colors",
          !activeCircle ? "bg-black text-white border-black" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
        )}
        aria-pressed={!activeCircle}
        aria-label="All circles"
        title="All"
      >
        All
      </button>

      {list.map((c: any) => {
        const id = c?.id as CircleId;
        const isActive = !!activeCircle && id === activeCircle;
        const lbl = labelOf(c);

        return (
          <button
            key={String(id)}
            type="button"
            onClick={() => onPick(id)}
            className={cn(
              "flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1",
              isActive ? "bg-black text-white border-black" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            )}
            aria-pressed={isActive}
            title={lbl}
          >
            <CircleIcon className={cn("w-3 h-3", isActive ? "text-white" : "text-gray-400")} aria-hidden />
            <span className="truncate max-w-[160px]">{lbl}</span>
          </button>
        );
      })}

      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 flex items-center gap-1"
          aria-label="Create new circle"
          title="New circle"
        >
          <Plus className="w-3 h-3" aria-hidden />
          New
        </button>
      ) : null}
    </div>
  );
}
