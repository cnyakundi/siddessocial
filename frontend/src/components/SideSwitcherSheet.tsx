"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, Lock } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";
import type { SideActivityMap } from "@/src/lib/sideActivity";
import { formatActivityPill } from "@/src/lib/sideActivity";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function SideSwitcherSheet({
  open,
  onClose,
  currentSide,
  activity,
  onSwitch,
}: {
  open: boolean;
  onClose: () => void;
  currentSide: SideId;
  activity: SideActivityMap;
  onSwitch: (side: SideId) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useDialogA11y({ open: open && mounted, containerRef: panelRef, initialFocusRef: cancelRef });

  useLockBodyScroll(open && mounted);

  const handleSwitch = (nextSide: SideId) => {
    onSwitch(nextSide);
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close side switcher"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onPointerDown={(e) => {
        // sd_481_sheet_close_reliability: pointerdown closes reliably on mobile
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        e.preventDefault();
        onClose();
      }}
      />
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="side-switcher-title" className="relative w-full max-w-[430px] bg-white rounded-t-[3rem] md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-10 fade-in duration-200">
        <div className="w-10 h-1.5 bg-gray-100 rounded-full mx-auto mb-6" />
        <h3 id="side-switcher-title" className="text-xl font-black tracking-tight text-gray-900 mb-4 px-1">Side</h3>

        <div className="space-y-3">
          {SIDE_ORDER.map((sideId) => {
            const meta = SIDES[sideId];
            const theme = SIDE_THEMES[sideId];
            const isActive = sideId === currentSide;

            const a = activity[sideId];
            const hasActivity = a.unread > 0;
            const isHot = a.unread >= 20;

            return (
              <button
                key={sideId}
                type="button"
                onClick={() => handleSwitch(sideId)}
                className={cn(
                  "w-full h-20 px-5 rounded-[2rem] flex items-center gap-4 transition-all border",
                  isActive ? cn(theme.border, theme.lightBg) : "border-transparent hover:bg-gray-50"
                )}
              >
                <div className={cn("w-14 h-14 rounded-3xl flex items-center justify-center relative", theme.lightBg)}>
                  <div className={cn("w-2 h-10 rounded-full", theme.primaryBg)} />
                  {!isActive && hasActivity ? (
                    <div
                      className={cn(
                        "absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white",
                        isHot ? "bg-red-500" : theme.primaryBg
                      )}
                    />
                  ) : null}
                </div>

                <div className="text-left flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold text-base", isActive ? theme.text : "text-gray-900")}>{meta.label}</span>
                    {meta.isPrivate ? <Lock size={14} className="text-gray-400" /> : null}
                  </div>

                  {sideId === "work" && (a.mentions || a.docs) ? (
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {a.mentions ? (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          Mentions {a.mentions}
                        </span>
                      ) : null}
                      {a.docs ? (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          Docs {a.docs}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">{meta.desc}</div>
                  )}
                </div>

                {!isActive && hasActivity ? (
                  <div
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold",
                      isHot ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"
                    )}
                    aria-label={a.unread + " new items"}
                  >
                    {formatActivityPill(a.unread)}
                  </div>
                ) : null}

                {isActive ? <Check size={20} className={theme.text} /> : null}
              </button>
            );
          })}
        </div>

        <button ref={cancelRef} type="button" onClick={onClose} className="w-full mt-6 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-2xl">
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
