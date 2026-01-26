"use client";

import React, { useRef } from "react";
import { X } from "lucide-react";
import type { Chip } from "@/src/lib/chips";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function ChipOverflowSheet({
  open,
  onClose,
  chips,
  title = "More context",
}: {
  open: boolean;
  onClose: () => void;
  chips: Chip[];
  title?: string;
}) {
  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onPointerDown={(e) => {
        // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click)
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
        aria-label="Close"
      />
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="chip-overflow-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200 max-h-[85dvh] md:max-h-[80vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-4">
          <div id="chip-overflow-title" className="text-lg font-bold text-gray-900">{title}</div>
          <button
            type="button"
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close sheet"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-2">
          {chips.map((c) => (
            <div
              key={c.id}
              className={cn(
                "w-full p-3 rounded-2xl flex items-center gap-3 border",
                c.className
              )}
            >
              <div className="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center">
                <c.icon size={16} />
              </div>
              <div className="font-bold text-sm">{c.label}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl"
        >
          Close
        </button>
      </div>
    </div>
  );
}
