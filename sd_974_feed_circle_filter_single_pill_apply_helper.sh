#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_974_feed_circle_filter_single_pill"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"

CF="frontend/src/components/CircleFilterBar.tsx"
SF="frontend/src/components/SideFeed.tsx"
STATE="docs/STATE.md"

echo "== ${SD_ID} =="
echo "Root: ${ROOT}"

[[ -d frontend ]] || { echo "❌ Missing frontend/ (run from repo root)"; exit 1; }
[[ -d backend  ]] || { echo "❌ Missing backend/ (run from repo root)"; exit 1; }
[[ -f "$SF"    ]] || { echo "❌ Missing: $SF"; exit 1; }

mkdir -p "$BK"
[[ -f "$CF" ]] && cp -a "$CF" "$BK/CircleFilterBar.tsx.bak" || true
cp -a "$SF" "$BK/SideFeed.tsx.bak"
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

# Legacy gate safety (some checks still reference this file name)
if [[ ! -f "docs/SETS_BACKEND.md" ]]; then
  mkdir -p docs
  cat > docs/SETS_BACKEND.md <<'DOC'
# Sets backend (legacy alias)

This file exists only to satisfy legacy checks still referencing `docs/SETS_BACKEND.md`.

Canonical docs:
- docs/CIRCLES_BACKEND.md
DOC
  echo "✅ Created docs/SETS_BACKEND.md (alias)"
fi

echo ""
echo "== Patch 1/2: Rewrite CircleFilterBar to a single pill + picker sheet =="

mkdir -p "$(dirname "$CF")"
cat > "$CF" <<'TSX'
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
    return (t?.primaryBg || "bg-gray-700").replace("text-", "bg-");
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
TSX

echo "✅ Wrote $CF"

echo ""
echo "== Patch 2/2: Ensure SideFeed passes currentSide={side} into CircleFilterBar =="

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/SideFeed.tsx")
s = p.read_text(encoding="utf-8")

if "CircleFilterBar" not in s:
    raise SystemExit("ERROR: SideFeed.tsx does not reference CircleFilterBar (file shape changed).")

if "currentSide={side}" in s:
    print("OK: SideFeed already passes currentSide={side}")
else:
    # Insert after activeSet prop if present
    s2, n = re.subn(r'(activeSet=\{activeSet\}\s*\n)', r'\1      currentSide={side}\n', s, count=1)
    if n != 1:
        # fallback: insert after sets prop
        s2, n = re.subn(r'(sets=\{[^}]+\}\s*\n)', r'\1      currentSide={side}\n', s, count=1)
        if n != 1:
            raise SystemExit("ERROR: Could not find a safe anchor in SideFeed CircleFilterBar props.")
    s = s2
    p.write_text(s, encoding="utf-8")
    print("✅ Patched SideFeed: added currentSide={side}")
PY

# docs/STATE best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Feed: replace Circle chips row with a single 'Circle ▾' pill (CirclesMark + dot) that opens CirclePickerSheet.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
( cd frontend && npm run typecheck && npm run build )
bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Smoke test:"
echo "  - Open /siddes-feed?side=friends"
echo "  - You should see ONE Circle pill (not a chips row)"
echo "  - Tap it -> CirclePickerSheet opens (create happens inside sheet)"
