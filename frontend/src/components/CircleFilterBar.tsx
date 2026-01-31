"use client";

// sd_974_feed_circle_filter_single_pill
// Goal: replace horizontal chip row with ONE calm pill that opens CirclePickerSheet.

import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { CircleDef, CircleId } from "@/src/lib/circles";
import type { SideId } from "@/src/lib/sides";
import { getCircleTheme } from "@/src/lib/circleThemes";
import { CirclePickerSheet } from "@/src/components/CirclePickerSheet";
import { CirclesMark } from "@/src/components/icons/CirclesMark";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function Dot({ cls }: { cls: string }) {
  return <span className={cn("w-1.5 h-1.5 rounded-full", cls)} aria-hidden="true" />;
}

/**
 * Single control:
 * - Label: All / Circle name
 * - Opens: CirclePickerSheet (recents + create inside sheet)
 */
export function CircleFilterBar({
  sets,
  activeSet,
  onSetChange,
  onNewSet,
  label = "Circle",
  allLabel = "All",
  currentSide,
}: {
  sets: CircleDef[];
  activeSet: CircleId | null;
  onSetChange: (next: CircleId | null) => void;
  onNewSet?: () => void;
  label?: string;
  allLabel?: string;
  currentSide?: SideId;
}) {
  const list = useMemo(() => (Array.isArray(sets) ? sets : []), [sets]);

  const effectiveActive = useMemo<CircleId | null>(() => {
    if (!activeSet) return null;
    return list.some((c) => c.id === activeSet) ? activeSet : null;
  }, [activeSet, list]);

  const active = useMemo(() => {
    if (!effectiveActive) return null;
    return list.find((c) => c.id === effectiveActive) || null;
  }, [effectiveActive, list]);

  const side: SideId = useMemo(() => {
    if (currentSide) return currentSide;
    if (active?.side) return active.side;
    const first = list[0]?.side;
    return (first as SideId) || "friends";
  }, [currentSide, active, list]);

  const title = active ? active.label : allLabel;

  const dotCls = useMemo(() => {
    if (!active) return "bg-gray-400";
    const t = getCircleTheme(active.color);
    // fallback to neutral if theme missing
    return (t?.text || "text-gray-700").replace("text-", "bg-");
  }, [active]);

  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 inline-flex items-center gap-2 px-3 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors min-w-0"
        aria-label={`${label}: ${title}`}
        title="Choose circle"
        data-testid="set-filter-bar"
      >
        <CirclesMark size={16} className="text-gray-400 shrink-0" />
        <Dot cls={dotCls} />
        <span className="text-sm font-extrabold text-gray-900 truncate">{title}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
      </button>

      <CirclePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        sets={list}
        activeSet={effectiveActive}
        onPick={(next) => onSetChange(next)}
        onNewSet={onNewSet}
        title={label}
        allLabel={allLabel}
        currentSide={side}
      />
    </>
  );
}
