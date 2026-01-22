"use client";

import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { useSide } from "@/src/components/SideProvider";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type Mode = "tint" | "cinematic";

type AirlockState = {
  mode: Mode;
  from: SideId;
  to: SideId;
};

/**
 * sd_506: Desktop Airlock overlay (lg+ only).
 * - Private ↔ Private: subtle 150ms tint (prevents "tab change" feeling)
 * - To/From Public: 700ms cinematic seal (safety ritual, not a loading screen)
 *
 * Deterministic: purely cosmetic; does not imply network work.
 */
export function DesktopAirlockOverlay() {
  const { side } = useSide();
  const prevRef = useRef<SideId>(side);
  const [st, setSt] = useState<AirlockState | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = side;

    if (from === to) return;

    prevRef.current = to;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const cinematic = from === "public" || to === "public";
    const mode: Mode = cinematic ? "cinematic" : "tint";
    setSt({ mode, from, to });

    const ms = cinematic ? 700 : 150;
    timerRef.current = window.setTimeout(() => {
      setSt(null);
      timerRef.current = null;
    }, ms);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [side]);

  if (!st) return null;

  const theme = SIDE_THEMES[st.to];
  const toLabel = SIDES[st.to].label;
  const fromLabel = SIDES[st.from].label;

  const enteringPublic = st.to === "public" && st.from !== "public";
  const leavingPublic = st.from === "public" && st.to !== "public";

  const sub = enteringPublic
    ? `Entering ${toLabel}`
    : leavingPublic
      ? `Leaving ${fromLabel}`
      : `Switching to ${toLabel}`;

  return (
    <div className="fixed inset-0 z-[180] pointer-events-none hidden lg:block" aria-hidden="true">
      {/* Subtle tint (always) */}
      <div
        className={cn(
          "absolute inset-0",
          theme.primaryBg,
          "transition-opacity duration-150",
          st.mode === "cinematic" ? "opacity-10 animate-pulse" : "opacity-[0.035]"
        )}
      />

      {/* Cinematic seal only for Public transitions */}
      {st.mode === "cinematic" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white/20 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
            <div className={cn("w-16 h-16 rounded-[2rem] text-white flex items-center justify-center shadow-xl", theme.primaryBg)}>
              <ShieldCheck size={32} strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <div className="text-[12px] font-black uppercase tracking-[0.3em] text-gray-900">Airlock sealing</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">{sub}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
