"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import type { CircleDef, CircleId } from "@/src/lib/circles";
import { getCircleTheme } from "@/src/lib/circleThemes";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function SetDot({ colorClass }: { colorClass: string }) {
  return <span className={cn("w-2 h-2 rounded-full bg-current", colorClass)} aria-hidden="true" />;
}

export function CircleFilterBar({
  sets,
  activeSet,
  onSetChange,
  onNewSet,
  label = "Circle",
  allLabel = "All",
}: {
  sets: CircleDef[];
  activeSet: CircleId | null;
  onSetChange: (next: CircleId | null) => void;
  onNewSet?: () => void;
  label?: string;
  allLabel?: string;
}) {
  const list = useMemo(() => (Array.isArray(sets) ? sets : []), [sets]);

  // Guard: if the activeSet is stale, fall back to All.
  const effectiveActive = useMemo<CircleId | null>(() => {
    if (!activeSet) return null;
    return list.some((s) => s.id === activeSet) ? activeSet : null;
  }, [activeSet, list]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeBtnRef = useRef<HTMLButtonElement | null>(null);

  // PWA ergonomics: keep the active pill visible.
  useEffect(() => {
    const el = activeBtnRef.current;
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    } catch {
      // ignore
    }
  }, [effectiveActive, list.length]);

  return (
    <div data-testid="set-filter-bar" aria-label={`${label} filter`}>
      <div
        ref={containerRef}
        className="flex gap-2 overflow-x-auto no-scrollbar pb-2"
        role="tablist"
        aria-orientation="horizontal"
      >
        <button
          type="button"
          ref={(el) => {
            if (effectiveActive === null) activeBtnRef.current = el;
          }}
          onClick={() => onSetChange(null)}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2",
            effectiveActive === null ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
          aria-label={`${label}: ${allLabel}`}
          aria-pressed={effectiveActive === null}
        >
          <SetDot colorClass={effectiveActive === null ? "text-white" : "text-gray-400"} />
          <span className="truncate max-w-[14rem]">{allLabel}</span>
        </button>

        {list.map((s) => {
          const active = effectiveActive === s.id;
          const theme = getCircleTheme(s.color);
          return (
            <button
              key={s.id}
              type="button"
              ref={(el) => {
                if (active) activeBtnRef.current = el;
              }}
              onClick={() => onSetChange(s.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2",
                active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
              aria-label={`${label}: ${s.label}`}
              aria-pressed={active}
            >
              <SetDot colorClass={active ? theme.text : theme.text} />
              <span className="truncate max-w-[14rem]">{s.label}</span>
            </button>
          );
        })}

        {onNewSet ? (
          <button
            type="button"
            onClick={onNewSet}
            className="px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-700 text-sm font-bold hover:border-gray-400 hover:bg-gray-50 inline-flex items-center gap-2 whitespace-nowrap"
            aria-label="New Circle"
          >
            <Plus size={16} />
            New
          </button>
        ) : null}
      </div>
    </div>
  );
}
