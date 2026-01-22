"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { NotificationsView } from "@/src/components/NotificationsView";

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
  // Lock body scroll while open (mobile polish)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] lg:hidden"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" />

      <div
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
            <div className="text-xl font-black tracking-tight text-gray-900">Notifications</div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">Deterministic • Server truth</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-2xl border border-gray-200 bg-white text-gray-400 inline-flex items-center justify-center active:scale-95 transition-transform"
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
