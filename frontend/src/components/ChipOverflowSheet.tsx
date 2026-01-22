"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import type { Chip } from "@/src/lib/chips";

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
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center md:items-center">
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
        aria-label="Close"
      />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-gray-900">{title}</div>
          <button
            type="button"
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
