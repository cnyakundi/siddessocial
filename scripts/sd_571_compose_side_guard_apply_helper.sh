#!/usr/bin/env bash
set -euo pipefail

NAME="sd_571_compose_side_guard"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

REQUIRED=(
  "frontend/src/lib/flags.ts"
  "frontend/src/app/siddes-compose/client.tsx"
)
for f in "${REQUIRED[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Expected file not found: $f" >&2
    echo "Run this from your repo root (sidesroot)." >&2
    exit 1
  fi
done

ts="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.backup_${NAME}_${ts}"
mkdir -p "$BACKUP"

backup_one() {
  local rel="$1"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -a "$rel" "$BACKUP/$rel"
}

# Back up modified files (and any existing versions of newly-added files)
backup_one "frontend/src/lib/flags.ts"
backup_one "frontend/src/app/siddes-compose/client.tsx"
if [[ -f "frontend/src/lib/composeAudienceGuard.ts" ]]; then
  backup_one "frontend/src/lib/composeAudienceGuard.ts"
fi
if [[ -f "frontend/src/components/ComposeAudienceGuardSheet.tsx" ]]; then
  backup_one "frontend/src/components/ComposeAudienceGuardSheet.tsx"
fi

python3 - <<'PY'
from __future__ import annotations

from pathlib import Path
import re
import sys

root = Path(".")
patched: list[str] = []

GUARD_FILE = r'''"use client";

// sd_571: high-confidence wrong-audience (Side) guard for compose

import type { SideId } from "@/src/lib/sides";

export type ComposeAudienceGuardResult = {
  suggestedSide: SideId;
  confidence: number;
  reason: string;
  reasonCode: "SIDE_MISMATCH";
};

function norm(s: string): string {
  return (s || "").toLowerCase().trim();
}

function countHits(hay: string, needles: string[]): number {
  let c = 0;
  for (const n of needles) {
    if (hay.includes(n)) c += 1;
  }
  return c;
}

export function computeComposeAudienceGuard(args: {
  text: string;
  currentSide: SideId;
}): ComposeAudienceGuardResult | null {
  const raw = (args.text || "").trim();
  if (!raw) return null;

  // High-confidence only: avoid nagging on short drafts.
  if (raw.length < 20) return null;

  const t = norm(raw);

  // Keep lexicon minimal + high signal (utility, not vibes).
  const work = [
    "standup",
    "roadmap",
    "pr",
    "merge",
    "deploy",
    "jira",
    "sprint",
    "meeting",
    "deck",
    "slides",
    "review",
    "deadline",
    "handoff",
    "ticket",
    "blocker",
    "incident",
    "eod",
  ];
  const close = ["love you", "miss you", "mom", "dad", "family", "sweetie", "call me"];
  const friends = ["bbq", "gym", "leg day", "workout", "weekend", "hangout", "party", "brisket", "brunch"];

  const w = countHits(t, work);
  const c = countHits(t, close);
  const f = countHits(t, friends);

  const scored = [
    { side: "work" as SideId, hits: w, reason: "Mentions work terms" },
    { side: "close" as SideId, hits: c, reason: "Mentions close people" },
    { side: "friends" as SideId, hits: f, reason: "Mentions friends" },
  ].sort((a, b) => b.hits - a.hits);

  const best = scored[0];
  const second = scored[1];

  if (!best || best.hits <= 0) return null;
  if (best.side === args.currentSide) return null;

  // Strict: require multiple high-signal cues + a clear margin.
  if (best.hits < 2) return null;
  if (second and best.hits < second.hits + 1) return null;  # noqa: E999 (string-only)

  const confidence = Math.min(0.95, 0.55 + best.hits * 0.12);
  if (confidence < 0.78) return null;

  return {
    suggestedSide: best.side,
    confidence,
    reason: best.reason,
    reasonCode: "SIDE_MISMATCH",
  };
}
'''

# NOTE: the line `if (second and ...)` above is intentionally invalid TS if written verbatim.
# We fix it immediately below before writing the file.
GUARD_FILE = GUARD_FILE.replace("if (second and", "if (second &&")

SHEET_FILE = r'''"use client";

// sd_571: compose Side Guard confirm sheet (reversible, explainable)

import React, { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function ComposeAudienceGuardSheet({
  open,
  currentSide,
  suggestedSide,
  reason,
  onClose,
  onSwitchSide,
  onPostAnyway,
}: {
  open: boolean;
  currentSide: SideId;
  suggestedSide: SideId;
  reason: string;
  onClose: () => void;
  onSwitchSide: () => void;
  onPostAnyway: () => void;
}) {
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const t = SIDE_THEMES[suggestedSide];
  const curT = SIDE_THEMES[currentSide];
  const label = SIDES[suggestedSide].label;

  return (
    <div className="fixed inset-0 z-[121] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close audience guard"
      />

      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200"
        data-testid="compose-guard-sheet"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <div className="font-bold text-gray-900">Check audience?</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={cn(
              "text-[10px] px-2 py-1 rounded-full border font-black uppercase tracking-widest",
              curT.lightBg,
              curT.text,
              curT.border
            )}
          >
            Current: {SIDES[currentSide].label}
          </span>
          <span
            className={cn(
              "text-[10px] px-2 py-1 rounded-full border font-black uppercase tracking-widest",
              t.lightBg,
              t.text,
              t.border
            )}
          >
            Suggested: {label}
          </span>
        </div>

        <div className="text-sm text-gray-700 mb-4">
          Looks like <span className={cn("font-bold", t.text)}>{label}</span> — {reason}.
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onSwitchSide}
            className={cn(
              "w-full py-3 rounded-2xl font-extrabold text-white hover:opacity-90 active:scale-[0.99] transition-all",
              t.primaryBg
            )}
          >
            Switch to {label}
          </button>

          <button
            type="button"
            onClick={onPostAnyway}
            className="w-full py-3 rounded-2xl font-extrabold border border-gray-200 text-gray-800 hover:bg-gray-50 active:scale-[0.99] transition-all"
          >
            Post anyway
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-semibold text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <div className="text-[11px] text-gray-400 mt-3">
          Tap-to-apply. Siddes never auto-switches.
        </div>
      </div>
    </div>
  );
}
'''

def write(path: Path, s: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(s, encoding="utf-8")

# --- 1) Add new files ---
guard_path = root / "frontend/src/lib/composeAudienceGuard.ts"
if guard_path.exists():
    existing = guard_path.read_text(encoding="utf-8")
    if "sd_571" in existing and "computeComposeAudienceGuard" in existing:
        print("OK: composeAudienceGuard.ts already present")
    else:
        write(guard_path, GUARD_FILE)
        patched.append(str(guard_path))
        print("PATCHED: composeAudienceGuard.ts (written/updated)")
else:
    write(guard_path, GUARD_FILE)
    patched.append(str(guard_path))
    print("ADDED: composeAudienceGuard.ts")

sheet_path = root / "frontend/src/components/ComposeAudienceGuardSheet.tsx"
if sheet_path.exists():
    existing = sheet_path.read_text(encoding="utf-8")
    if "sd_571" in existing and "ComposeAudienceGuardSheet" in existing:
        print("OK: ComposeAudienceGuardSheet.tsx already present")
    else:
        write(sheet_path, SHEET_FILE)
        patched.append(str(sheet_path))
        print("PATCHED: ComposeAudienceGuardSheet.tsx (written/updated)")
else:
    write(sheet_path, SHEET_FILE)
    patched.append(str(sheet_path))
    print("ADDED: ComposeAudienceGuardSheet.tsx")

# --- 2) flags.ts: add FLAGS.composeSideGuard ---
flags_path = root / "frontend/src/lib/flags.ts"
flags_src = flags_path.read_text(encoding="utf-8")

if "composeSideGuard:" in flags_src:
    print("OK: flags.ts already has FLAGS.composeSideGuard")
else:
    insert = (
        '  // Compose audience guard (high-confidence wrong-side warning). Default OFF.\\n'
        '  composeSideGuard: process.env.NEXT_PUBLIC_SD_COMPOSE_SIDE_GUARD === "1",\\n'
    )
    if "composeSuggestions:" in flags_src:
        flags_new = re.sub(r'(\\n\\s*composeSuggestions:[^\\n]*\\n)', lambda m: m.group(1) + insert, flags_src, count=1)
    else:
        flags_new = flags_src

    if flags_new == flags_src:
        flags_new = re.sub(r'\\n\\}\\s*as const;\\s*$', '\\n' + insert + '\\n} as const;\\n', flags_src, count=1)

    if flags_new == flags_src:
        print("ERROR: Could not patch flags.ts (pattern mismatch).")
        sys.exit(2)

    write(flags_path, flags_new)
    patched.append(str(flags_path))
    print("PATCHED: flags.ts (added FLAGS.composeSideGuard)")

# --- 3) siddes-compose client: wire Side Guard ---
compose_path = root / "frontend/src/app/siddes-compose/client.tsx"
src = compose_path.read_text(encoding="utf-8")

# imports
if "ComposeAudienceGuardSheet" not in src:
    marker = 'import { ComposeSuggestionBar } from "@/src/components/ComposeSuggestionBar";'
    if marker not in src:
        print("ERROR: Could not locate ComposeSuggestionBar import in compose client.tsx")
        sys.exit(2)
    add = (
        marker
        + "\\nimport { ComposeAudienceGuardSheet } from \\"@/src/components/ComposeAudienceGuardSheet\\";\\n"
        + "import { computeComposeAudienceGuard, type ComposeAudienceGuardResult } from \\"@/src/lib/composeAudienceGuard\\";\\n"
    )
    src = src.replace(marker, add, 1)
    print("PATCHED: compose client.tsx (imports Side Guard)")
    patched.append(str(compose_path))

# state
if "guardOpen" not in src or "guardSuggestion" not in src:
    needle = 'const [pendingPublicText, setPendingPublicText] = useState<string | null>(null);'
    if needle not in src:
        print("ERROR: Could not locate pendingPublicText state in compose client.tsx")
        sys.exit(2)
    state_block = (
        needle
        + "\\n\\n  // Compose Side Guard (wrong-audience prevention). Default OFF; blocks only on high confidence.\\n"
        + "  const [guardOpen, setGuardOpen] = useState(false);\\n"
        + "  const [guardPendingText, setGuardPendingText] = useState<string | null>(null);\\n"
        + "  const [guardSuggestion, setGuardSuggestion] = useState<ComposeAudienceGuardResult | null>(null);\\n"
    )
    src = src.replace(needle, state_block, 1)
    print("PATCHED: compose client.tsx (added Side Guard state)")
    patched.append(str(compose_path))

# submit() patch
if "const sideGuardEnabled" not in src or "computeComposeAudienceGuard" not in src:
    pat = r'(\\n\\s*async function submit\\(\\) \\{\\n)(.*?)(\\n\\s*\\}\\n\\n\\s*const openAudience)'
    m = re.search(pat, src, flags=re.S)
    if not m:
        print("ERROR: Could not locate submit() block in compose client.tsx")
        sys.exit(2)
    indent = re.match(r"\\s*", m.group(1)).group(0)

    new_submit = (
        "\\n" + indent + "async function submit() {\\n"
        + indent + "  const t = text.trim();\\n"
        + indent + "  if (!t) return;\\n\\n"
        + indent + "  if (overLimit) {\\n"
        + indent + "    setError({ kind: \\"validation\\", message: `Too long. Max ${maxChars} characters.` });\\n"
        + indent + "    saveCurrentDraft();\\n"
        + indent + "    return;\\n"
        + indent + "  }\\n\\n"
        + indent + "  const sideGuardEnabled = !FLAGS.panicMode && (FLAGS.composeSideGuard || isAdvanced);\\n"
        + indent + "  if (sideGuardEnabled) {\\n"
        + indent + "    const guard = computeComposeAudienceGuard({ text: t, currentSide: side });\\n"
        + indent + "    if (guard) {\\n"
        + indent + "      setGuardSuggestion(guard);\\n"
        + indent + "      setGuardPendingText(t);\\n"
        + indent + "      setGuardOpen(true);\\n"
        + indent + "      return;\\n"
        + indent + "    }\\n"
        + indent + "  }\\n\\n"
        + indent + "  if (side === \\"public\\" && shouldConfirmPublic()) {\\n"
        + indent + "    setPendingPublicText(t);\\n"
        + indent + "    setPublicConfirmOpen(true);\\n"
        + indent + "    return;\\n"
        + indent + "  }\\n\\n"
        + indent + "  await postNow(t);\\n"
        + indent + "}\\n\\n"
        + m.group(3)
    )
    src = src[:m.start(1)] + new_submit + src[m.end(3):]
    print("PATCHED: compose client.tsx (submit() Side Guard preflight)")
    patched.append(str(compose_path))

# render guard sheet
if "<ComposeAudienceGuardSheet" not in src:
    mm = re.search(r'^(?P<indent>\\s*)\\{\\/\\* Public confirm \\(above everything\\) \\*\\/\\}\\s*$', src, flags=re.M)
    if not mm:
        print("ERROR: Could not locate Public confirm comment marker in compose client.tsx")
        sys.exit(2)
    indent = mm.group("indent")

    block = (
        f"{indent}{{/* Side Guard (high-confidence wrong-audience warning) */}}\\n"
        f"{indent}<ComposeAudienceGuardSheet\\n"
        f"{indent}  open={{guardOpen}}\\n"
        f"{indent}  currentSide={{side}}\\n"
        f"{indent}  suggestedSide={{(guardSuggestion?.suggestedSide ?? side)}}\\n"
        f"{indent}  reason={{guardSuggestion?.reason ?? \\\"\\\"}}\\n"
        f"{indent}  onClose={{() => {{\\n"
        f"{indent}    setGuardOpen(false);\\n"
        f"{indent}    setGuardPendingText(null);\\n"
        f"{indent}    setGuardSuggestion(null);\\n"
        f"{indent}  }}}}\\n"
        f"{indent}  onSwitchSide={{() => {{\\n"
        f"{indent}    const target = guardSuggestion?.suggestedSide;\\n"
        f"{indent}    setGuardOpen(false);\\n"
        f"{indent}    setGuardPendingText(null);\\n"
        f"{indent}    setGuardSuggestion(null);\\n"
        f"{indent}    if (target) setSide(target);\\n"
        f"{indent}  }}}}\\n"
        f"{indent}  onPostAnyway={{() => {{\\n"
        f"{indent}    const t = (guardPendingText || text).trim();\\n"
        f"{indent}    setGuardOpen(false);\\n"
        f"{indent}    setGuardPendingText(null);\\n"
        f"{indent}    setGuardSuggestion(null);\\n"
        f"{indent}    if (!t) return;\\n"
        f"{indent}    if (side === \\\"public\\\" && shouldConfirmPublic()) {{\\n"
        f"{indent}      setPendingPublicText(t);\\n"
        f"{indent}      setPublicConfirmOpen(true);\\n"
        f"{indent}      return;\\n"
        f"{indent}    }}\\n"
        f"{indent}    void postNow(t);\\n"
        f"{indent}  }}}}\\n"
        f"{indent}/>\\n\\n"
    )
    src = src[:mm.start()] + block + src[mm.start():]
    print("PATCHED: compose client.tsx (rendered guard sheet)")
    patched.append(str(compose_path))

# write compose client if changed
compose_path.write_text(src, encoding="utf-8")

print("\\n== Summary ==")
if patched:
    for p in patched:
        print("TOUCHED:", p)
else:
    print("No changes were necessary (already up to date).")
PY

echo
echo "✅ ${NAME} applied."
echo "Backup: ${BACKUP}"
echo
cat <<'NEXT'
Next (VS Code terminal):
  ./verify_overlays.sh
  cd frontend && npm run typecheck && npm run build

Enable:
  - Advanced-only: /siddes-compose?advanced=1
  - Or env: NEXT_PUBLIC_SD_COMPOSE_SIDE_GUARD=1

Smoke:
  1) Open /siddes-compose?advanced=1
  2) In Friends, type: "Standup moved to 10am. Need slides by EOD."
  3) Tap Post -> should show a "Check audience?" sheet
  4) Tap "Switch to Work" (draft remains), then Post again
NEXT
BASH
