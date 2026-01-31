#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_934_feed_circle_row_picker"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK="${ROOT}/.backup_${SD_ID}_${TS}"

echo "== ${SD_ID} =="
echo "Root: ${ROOT}"

if [[ ! -d "${ROOT}/frontend" ]] || [[ ! -d "${ROOT}/backend" ]]; then
  echo "❌ Run from repo root (must contain frontend/ and backend/)"
  exit 1
fi

mkdir -p "$BK"
cp -a "frontend/src/components/CircleFilterBar.tsx" "$BK/CircleFilterBar.tsx.bak" 2>/dev/null || true
cp -a "frontend/src/components/SideFeed.tsx" "$BK/SideFeed.tsx.bak" 2>/dev/null || true
cp -a "docs/STATE.md" "$BK/STATE.md.bak" 2>/dev/null || true

# Gate expects this legacy doc name:
if [[ ! -f "docs/SETS_BACKEND.md" ]]; then
  cat > docs/SETS_BACKEND.md <<'DOC'
# Sets backend (legacy alias)

This file exists to satisfy legacy checks that still reference `docs/SETS_BACKEND.md`.

Canonical doc:
- docs/CIRCLES_BACKEND.md
DOC
  echo "✅ Created docs/SETS_BACKEND.md (alias)"
fi

# If ComposeMVP got corrupted by a bad patch (python f-string in TSX), restore from git.
if [[ -f "frontend/src/app/siddes-compose/ComposeMVP.tsx" ]]; then
  if grep -q 'f"{members} people"' "frontend/src/app/siddes-compose/ComposeMVP.tsx"; then
    echo "⚠️ Detected invalid python f-string inside ComposeMVP.tsx; restoring from git HEAD"
    git checkout -- "frontend/src/app/siddes-compose/ComposeMVP.tsx"
  fi
fi

# Replace CircleFilterBar chips row with ONE calm pill -> opens CirclePickerSheet
cat > frontend/src/components/CircleFilterBar.tsx <<'TSX'
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
 * sd_934_feed_circle_row_picker:
 * - Replace the horizontal chips row with one calm "Circle" pill
 * - Tap opens CirclePickerSheet (includes inline create + recents)
 * - Keeps SideFeed scroll clean on mobile
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
        currentSide={contextSide}
        onClose={() => setOpen(false)}
        sets={list}
        activeSet={effectiveActive}
        onPick={(next) => onSetChange(next)}
        onNewSet={onNewSet}
        title={label}
        allLabel={allLabel}
      />
    </>
  );
}
TSX

echo "✅ Patched frontend/src/components/CircleFilterBar.tsx"

# SideFeed: pass currentSide={side} to CircleFilterBar (nice & explicit)
python3 - <<'PY'
from pathlib import Path
p = Path("frontend/src/components/SideFeed.tsx")
s = p.read_text(encoding="utf-8")

if "CircleFilterBar" in s and "currentSide={side}" not in s:
    if "activeSet={activeSet}" in s:
        s = s.replace("activeSet={activeSet}\n", "activeSet={activeSet}\n      currentSide={side}\n", 1)
    else:
        s = s.replace(
            "sets={(sets || []).filter((s) => s.side === side)}\n",
            "sets={(sets || []).filter((s) => s.side === side)}\n      currentSide={side}\n",
            1
        )
    p.write_text(s, encoding="utf-8")
    print("✅ Patched SideFeed: added currentSide={side}")
else:
    print("OK: SideFeed already has currentSide={side} (or CircleFilterBar not found)")
PY

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "== DONE: ${SD_ID} =="
echo "Backup: ${BK}"
