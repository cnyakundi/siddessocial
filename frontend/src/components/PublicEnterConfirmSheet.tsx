"use client";

import React, { useRef } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { Globe } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function PublicEnterConfirmSheet({
  open,
  fromSide,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  fromSide: SideId;
  onCancel: () => void;
  onConfirm: () => void;
}) {


  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: cancelBtnRef, onClose: onCancel });
  if (!open) return null;

  const pub = SIDE_THEMES.public;
  const fromLabel = SIDES[fromSide]?.label || "";

  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onPointerDown={(e) => {
        // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click)
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }}
        aria-label="Cancel"
      />
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="public-enter-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white", pub.primaryBg)}>
            <Globe size={20} />
          </div>
          <div className="min-w-0">
            <div id="public-enter-title" className="text-lg font-black text-gray-900 leading-tight">Enter Public?</div>
            <div className="text-sm text-gray-500">Public is visible to anyone.</div>
          </div>
        </div>

        <div className="text-sm text-gray-700 leading-relaxed">
          Anything you post or reply to in <span className={cn("font-extrabold", pub.text)}>Public</span> can be seen by anyone.
        </div>

        <div className="mt-3 text-sm text-gray-600 leading-relaxed">
          If you meant to stay in <span className="font-extrabold text-gray-900">{fromLabel}</span>, tap Cancel.
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            ref={cancelBtnRef}
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-extrabold text-gray-700 border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn("flex-1 py-3 rounded-xl font-extrabold text-white hover:opacity-95", pub.primaryBg)}
          >
            Enter Public
          </button>
        </div>
      </div>
    </div>
  );
}
