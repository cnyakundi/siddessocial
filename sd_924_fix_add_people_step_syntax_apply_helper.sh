#!/usr/bin/env bash
set -euo pipefail

# sd_924_fix_add_people_step_syntax_apply_helper.sh
# Fix: TS1128 "Declaration or statement expected" in AddPeopleStep.tsx
# Approach: Replace AddPeopleStep.tsx with a clean, compile-safe implementation.

find_repo_root() {
  local d
  d="$(pwd)"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "❌ ERROR: Run inside the Siddes repo (must contain frontend/ and backend/)." >&2
  exit 1
fi

TARGET="$ROOT/frontend/src/components/onboarding/steps/AddPeopleStep.tsx"

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_924_fix_add_people_step_syntax_$TS"
mkdir -p "$BK/$(dirname "$TARGET")"
if [ -f "$TARGET" ]; then
  cp "$TARGET" "$BK/$(dirname "$TARGET")/AddPeopleStep.tsx"
fi

mkdir -p "$(dirname "$TARGET")"

cat > "$TARGET" <<'TSX'
"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, Users, CheckCircle2 } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { PrimaryButton } from "@/src/components/onboarding/ui";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeHandle(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return "";
  const noAt = t.replace(/^@+/, "");
  // Allow letters/numbers/underscore/dot. Drop everything else.
  const cleaned = noAt.replace(/[^\w.]/g, "");
  if (!cleaned) return "";
  return `@${cleaned}`;
}

function parseHandles(raw: string): string[] {
  const parts = String(raw || "")
    .split(/[\n,]+/g)
    .map((s) => normalizeHandle(s))
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export default function AddPeopleStep(props: {
  setName: string;
  sideId: SideId;
  myHandle?: string | null;
  onContinue: (payload: { handles: string[]; contactSyncDone: boolean }) => void;
  onSkip?: () => void;
}) {
  const { setName, sideId, myHandle, onContinue, onSkip } = props;

  const theme = SIDE_THEMES[sideId] || SIDE_THEMES.friends;
  const sideLabel = SIDES[sideId]?.label || String(sideId);

  const [raw, setRaw] = useState("");
  const [contactSyncDone, setContactSyncDone] = useState(false);

  const handles = useMemo(() => {
    const list = parseHandles(raw);
    const me = normalizeHandle(String(myHandle || ""));
    return me ? list.filter((h) => h !== me) : list;
  }, [raw, myHandle]);

  const submit = () => {
    onContinue({ handles, contactSyncDone });
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-16 pb-12">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">Add people</h2>
          <p className="text-sm text-gray-500 font-semibold mt-2 leading-relaxed">
            Optional. Add @handles now, or skip and do it later.
          </p>
        </div>

        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
            aria-label="Skip"
            title="Skip"
          >
            Skip
          </button>
        ) : null}
      </div>

      <div className="flex-1 w-full max-w-xl mx-auto">
        {/* Context preview */}
        <div className={cn("rounded-3xl border p-4 bg-white", theme.border)}>
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-white", theme.primaryBg)} aria-hidden="true">
              <Users size={18} strokeWidth={3} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Circle</div>
              <div className="text-base font-black text-gray-900 truncate">{setName || "Your circle"}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Side: <span className={cn("font-extrabold", theme.text)}>{sideLabel}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-bold text-gray-900 mb-2">Handles (comma or new line)</div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="@alex, @nina\n@mike"
              className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 min-h-[140px]"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-gray-500">
              <span>{handles.length ? <span className="font-bold text-gray-700">{handles.length} selected</span> : "No one added yet."}</span>
              {myHandle ? <span className="truncate">You: {normalizeHandle(myHandle) || myHandle}</span> : null}
            </div>
          </div>

          {/* Contacts (simple toggle stub) */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-gray-900">Sync contacts</div>
              <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                Optional. This just marks “done” for onboarding right now.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setContactSyncDone((v) => !v)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-xs font-extrabold border transition-colors inline-flex items-center gap-2",
                contactSyncDone ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
              aria-pressed={contactSyncDone}
              aria-label="Toggle contact sync"
              title="Toggle contact sync"
            >
              {contactSyncDone ? <CheckCircle2 size={14} /> : null}
              {contactSyncDone ? "Enabled" : "Enable"}
            </button>
          </div>

          <div className="mt-5">
            <PrimaryButton label="Continue" onClick={submit} icon={ArrowRight} />
          </div>

          <div className="mt-4 text-[11px] text-gray-400">
            Tip: You can always add people later from the circle hub.
          </div>
        </div>
      </div>
    </div>
  );
}
TSX

echo "✅ sd_924 applied."
echo "Backup: $BK"
echo ""
echo "Next:"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
