"use client";

import React, { useRef } from "react";
import { X } from "lucide-react";
import { NotificationsView } from "@/src/components/NotificationsView";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * sd_500: Mobile-only Notifications Drawer (bottom sheet).
 * Uses deterministic NotificationsView; no fake counts/percentages.
 */
export function NotificationsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useLockBodyScroll(open);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] lg:hidden"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-drawer-title"
        tabIndex={-1}

        className={cn(
          "absolute left-0 right-0 bottom-0",
          "bg-white rounded-t-[3rem] shadow-2xl",
          "animate-in slide-in-from-bottom-10 fade-in duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-4 px-4">
          <div className="w-10 h-1.5 bg-gray-100 rounded-full mx-auto" />
        </div>

        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div>
            <div id="notifications-drawer-title" className="text-xl font-black tracking-tight text-gray-900">Notifications</div>
          </div>
          <button
            type="button"
            ref={closeBtnRef}
            onClick={onClose}
            className="w-11 h-11 rounded-2xl border border-gray-200 bg-white text-gray-600 inline-flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Close"
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="px-4 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <div className="max-w-[430px] mx-auto">
            {/* NotificationsView already fetches /api/notifications and supports mark-all-read */}
            <div className="rounded-[2.5rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
              <NotificationsView />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
