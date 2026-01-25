"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { X } from "lucide-react";
import type { PublicChannelId } from "@/src/lib/publicChannels";
import { PUBLIC_CHANNELS } from "@/src/lib/publicChannels";
import { getPublicSidingChannels, setPublicSidingChannels } from "@/src/lib/publicSiding";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function PublicChannelPrefsSheet({
  open,
  onClose,
  authorKey,
  authorLabel,
}: {
  open: boolean;
  onClose: () => void;
  authorKey: string;
  authorLabel?: string;
}) {
  const title = useMemo(() => {
    const who = authorLabel ? authorLabel : authorKey;
    return `Public Topics • ${who}`;
  }, [authorKey, authorLabel]);

  const [selected, setSelected] = useState<PublicChannelId[]>([]);

  // Escape to close


  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });
  // Load current prefs on open (after mount)
  useEffect(() => {
    if (!open) return;
    setSelected(getPublicSidingChannels(authorKey));
  }, [open, authorKey]);

  if (!open) return null;

  const isChecked = (id: PublicChannelId) => selected.includes(id);

  const toggle = (id: PublicChannelId) => {
    const next = isChecked(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    setPublicSidingChannels(authorKey, next);
  };

  const setAll = () => {
    const next = PUBLIC_CHANNELS.map((c) => c.id);
    setSelected(next);
    setPublicSidingChannels(authorKey, next);
  };

  const setNone = () => {
    const next: PublicChannelId[] = [];
    setSelected(next);
    setPublicSidingChannels(authorKey, next);
  };

  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center md:items-center">
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
        aria-label="Close Public Topics sheet"
      />

      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="public-channel-prefs-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div id="public-channel-prefs-title" className="text-lg font-bold text-gray-900">{title}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Tune what you see from this person in the Public Side.
            </div>
          </div>
          <button
            type="button"
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={setAll}
            className="px-3 py-1.5 rounded-full text-xs font-bold border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          >
            All
          </button>
          <button
            type="button"
            onClick={setNone}
            className="px-3 py-1.5 rounded-full text-xs font-bold border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          >
            None
          </button>

          {selected.length === 0 ? (
            <span className="text-xs text-amber-600 font-semibold ml-1">
              Muted (no topics)
            </span>
          ) : null}
        </div>

        <div className="divide-y divide-gray-100">
          {PUBLIC_CHANNELS.map((c) => (
            <label
              key={c.id}
              className={cn(
                "flex items-start gap-3 py-3 cursor-pointer",
                isChecked(c.id) ? "opacity-100" : "opacity-80"
              )}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={isChecked(c.id)}
                onChange={() => toggle(c.id)}
              />
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-900">{c.label}</div>
                <div className="text-xs text-gray-500">{c.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl"
        >
          Done
        </button>
      </div>
    </div>
  );
}
