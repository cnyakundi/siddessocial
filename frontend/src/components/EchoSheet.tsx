"use client";

import React, { useRef } from "react";
import { Repeat, PenLine, X } from "lucide-react";
import type { FeedPost } from "@/src/lib/feedTypes";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES } from "@/src/lib/sides";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function EchoSheet({
  open,
  onClose,
  post,
  side,
  onEcho,
  onQuoteEcho,
  echoed = false,
  echoBusy = false,
}: {
  open: boolean;
  onClose: () => void;
  post: FeedPost | null;
  side: SideId;
  onEcho: () => void;
  onQuoteEcho: () => void;
  echoed?: boolean;
  echoBusy?: boolean;
}) {
  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open: open && Boolean(post), containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  if (!open || !post) return null;

  const theme = SIDE_THEMES[side];

  return (
    <div className="fixed inset-0 z-[97] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onPointerDown={(e) => {
        // sd_481_sheet_close_reliability: pointerdown closes reliably on mobile
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        e.preventDefault();
        onClose();
      }}
        aria-label="Close echo sheet"
      />
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="echo-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-5">
          <div id="echo-title" className="text-lg font-bold text-gray-900">Echo to your Side</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

                <div className="space-y-2">
          <button
            type="button"
            onClick={onEcho}
            disabled={echoBusy}
            className={cn(
              "w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left",
              echoBusy ? "opacity-60 cursor-not-allowed" : null
            )}
          >
            <div className={cn("w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm", theme.text)}>
              <Repeat size={20} />
            </div>
            <div>
              {echoed ? (
                <>
                  <div className="font-bold text-gray-900">Un-echo</div>
                  <div className="text-xs text-gray-500">Remove this echo from your current Side</div>
                </>
              ) : (
                <>
                  <div className="font-bold text-gray-900">Echo</div>
                  <div className="text-xs text-gray-500">Instantly share to your current Side</div>
                </>
              )}
            </div>
          </button>

          {side === "public" ? (
            <button
              type="button"
              onClick={onQuoteEcho}
              className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
            >
              <div className={cn("w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm", theme.text)}>
                <PenLine size={20} />
              </div>
              <div>
                <div className="font-bold text-gray-900">Quote Echo</div>
                <div className="text-xs text-gray-500">Add your thoughts</div>
              </div>
            </button>
          ) : null}
        </div>


        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
