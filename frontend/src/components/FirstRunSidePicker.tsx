"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { getStoredActiveSide } from "@/src/lib/sideStore";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const ORDER: SideId[] = ["friends", "close", "work", "public"];

export function FirstRunSidePicker() {
  const pathname = usePathname() || "";
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/about");
  const { setSide } = useSide();
  const [open, setOpen] = useState(false);

  const shouldShow = useMemo(() => {
    try {
      if (hideChrome) return false;
      return !getStoredActiveSide();
    } catch {
      return false;
    }
  }, [hideChrome]);

  useEffect(() => {
    if (shouldShow) setOpen(true);
  }, [shouldShow]);

  const closeToFriends = useCallback(() => {
    setSide("friends");
    setOpen(false);
  }, [setSide]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeToFriends();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeToFriends]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" data-testid="ftue-side-picker">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={closeToFriends} />

      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl p-5 shadow-2xl border border-gray-100">
        <div className="text-sm font-bold text-gray-900">Pick your default Side</div>
        <div className="text-xs text-gray-500 mt-1">Sides are audiences. Switch anytime from the top-left pill.</div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {ORDER.map((sid) => {
            const meta = SIDES[sid];
            const theme = SIDE_THEMES[sid];
            const recommended = sid === "friends";

            return (
              <button
                key={sid}
                type="button"
                onClick={() => {
                  setSide(sid);
                  setOpen(false);
                }}
                className={cn("text-left p-4 rounded-2xl border hover:opacity-90", theme.border, theme.lightBg)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", theme.primaryBg)} />
                    <span className={cn("text-sm font-bold", theme.text)}>{meta.label}</span>
                    {meta.isPrivate ? <Lock size={12} className={cn("opacity-60", theme.text)} /> : null}
                  </div>

                  {recommended ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                      Recommended
                    </span>
                  ) : null}
                </div>

                <div className="text-[11px] text-gray-600 mt-2">{meta.desc}</div>
                <div className="text-[11px] text-gray-500 mt-1">{meta.privacyHint}</div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={closeToFriends}
          className="w-full mt-4 py-3 font-semibold text-gray-600 hover:bg-gray-50 rounded-xl"
        >
          Start in Friends
        </button>
      </div>
    </div>
  );
}
