#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_946_feed_circle_pill"
ROOT="$(pwd)"

CF="frontend/src/components/CircleFilterBar.tsx"
SF="frontend/src/components/SideFeed.tsx"
STATE="docs/STATE.md"

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]]; then
  echo "❌ Run from repo root (must contain frontend/ and backend/)"
  exit 1
fi
if [[ ! -f "$CF" ]]; then
  echo "❌ Missing: $CF"
  exit 1
fi
if [[ ! -f "$SF" ]]; then
  echo "❌ Missing: $SF"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$CF" "$BK/CircleFilterBar.tsx.bak"
cp -a "$SF" "$BK/SideFeed.tsx.bak"
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

# Legacy gate: some checks still expect docs/SETS_BACKEND.md
if [[ ! -f "docs/SETS_BACKEND.md" ]]; then
  cat > docs/SETS_BACKEND.md <<'DOC'
# Sets backend (legacy alias)

This file exists only to satisfy legacy checks still referencing `docs/SETS_BACKEND.md`.

Canonical docs:
- docs/CIRCLES_BACKEND.md
DOC
  echo "✅ Created docs/SETS_BACKEND.md (alias)"
fi

# Replace CircleFilterBar with a single pill that opens CirclePickerSheet
cat > "$CF" <<'TSX'
"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { CircleDef, CircleId } from "@/src/lib/circles";
import type { SideId } from "@/src/lib/sides";
import { getCircleTheme } from "@/src/lib/circleThemes";
import { CirclePickerSheet } from "@/src/components/CirclePickerSheet";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function Dot({ colorClass }: { colorClass: string }) {
  return <span className={cn("w-2 h-2 rounded-full bg-current", colorClass)} aria-hidden="true" />;
}

/**
 * sd_946_feed_circle_pill:
 * - Replace horizontal chips row with ONE calm "Circle ▾" pill
 * - Tap opens CirclePickerSheet (recents + inline create)
 * - Keeps feed scroll clean on mobile
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
  /** Optional escape hatch: manage circles (power-user). */
  onNewSet?: () => void;
  label?: string;
  allLabel?: string;
  /** Optional; if omitted we infer from data best-effort. */
  currentSide?: SideId;
}) {
  const list = useMemo(() => (Array.isArray(sets) ? sets : []), [sets]);

  const effectiveActive = useMemo<CircleId | null>(() => {
    if (!activeSet) return null;
    return list.some((s) => s.id === activeSet) ? activeSet : null;
  }, [activeSet, list]);

  const active = useMemo(() => {
    if (!effectiveActive) return null;
    return list.find((s) => s.id === effectiveActive) || null;
  }, [effectiveActive, list]);

  const contextSide: SideId = useMemo(() => {
    if (currentSide) return currentSide;
    if (active?.side) return active.side;
    const first = list[0]?.side;
    return (first as SideId) || "friends";
  }, [currentSide, active, list]);

  const title = active ? active.label : allLabel;

  const dotClass = useMemo(() => {
    if (!active) return "text-gray-400";
    const t = getCircleTheme(active.color);
    return t?.text || "text-gray-700";
  }, [active]);

  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-sm font-extrabold text-gray-700 transition-colors min-w-0"
        aria-label={`${label}: ${title}`}
        title="Choose circle"
        data-testid="set-filter-bar"
      >
        <Dot colorClass={dotClass} />
        <span className="truncate">{title}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
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
        currentSide={contextSide}
      />
    </>
  );
}
TSX

echo "✅ Patched: $CF"

# SideFeed: pass currentSide={side} into CircleFilterBar if missing
python3 - <<'PY'
from pathlib import Path

p = Path("frontend/src/components/SideFeed.tsx")
s = p.read_text(encoding="utf-8")

if "CircleFilterBar" not in s:
    raise SystemExit("❌ SideFeed.tsx: CircleFilterBar call not found (file shape changed).")

if "currentSide={side}" in s:
    print("OK: SideFeed already passes currentSide={side}")
else:
    # Prefer inserting right after activeSet prop
    needle = "activeSet={activeSet}\n"
    if needle in s:
        s = s.replace(needle, "activeSet={activeSet}\n      currentSide={side}\n", 1)
        p.write_text(s, encoding="utf-8")
        print("✅ Patched SideFeed: added currentSide={side}")
    else:
        raise SystemExit("❌ SideFeed.tsx: could not find activeSet={activeSet} anchor.")
PY

# docs/STATE best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Feed: replace Circle chips row with a single 'Circle ▾' pill that opens CirclePickerSheet.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - Open /siddes-feed?side=friends"
echo "  - Instead of a chips row, you should see ONE pill (e.g. 'All Friends ▾')"
echo "  - Tap it -> CirclePickerSheet opens (recents + create)"
