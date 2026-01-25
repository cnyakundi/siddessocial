"use client";

import React, { useEffect, useRef } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

import { Check, Plus, X } from "lucide-react";
import type { SetDef, SetId } from "@/src/lib/sets";
import { getSetTheme } from "@/src/lib/setThemes";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function avatarUrl(seed: string): string {
  const s = String(seed || "").replace(/^@/, "").trim() || "user";
  // Dicebear is fine for mocks; replace with real profile media later.
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s)}`;
}

function MembersPreview({ members, inverted }: { members: string[]; inverted?: boolean }) {
  const list = Array.isArray(members) ? members.filter(Boolean) : [];
  if (!list.length) {
    return (
      <div className={cn("text-[11px] truncate", inverted ? "text-white/80" : "text-gray-500")}>
        No members yet
      </div>
    );
  }

  const shown = list.slice(0, 3);
  const more = Math.max(0, list.length - shown.length);

  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <div
            key={m}
            className={cn(
              "w-6 h-6 rounded-full border-2 overflow-hidden bg-gray-100 shadow-sm",
              inverted ? "border-white/40" : "border-white"
            )}
            title={m}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl(m)} alt={m} className="w-full h-full object-cover" />
          </div>
        ))}
        {more > 0 ? (
          <div
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black",
              inverted ? "border-white/40 bg-white/10 text-white" : "border-white bg-gray-100 text-gray-600"
            )}
            title={`${more} more`}
          >
            +{more}
          </div>
        ) : null}
      </div>

      <div className={cn("text-[11px] truncate", inverted ? "text-white/80" : "text-gray-500")}>
        {list.length} people
      </div>
    </div>
  );
}

export function SetPickerSheet({
  open,
  onClose,
  sets,
  activeSet,
  onPick,
  onNewSet,
  title = "Set",
  allLabel = "All",
}: {
  open: boolean;
  onClose: () => void;
  sets: SetDef[];
  activeSet: SetId | null;
  onPick: (next: SetId | null) => void;
  onNewSet?: () => void;
  title?: string;
  allLabel?: string;
}) {
  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close set picker"
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

      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="set-picker-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 id="set-picker-title" className="text-lg font-bold text-gray-900">{title}</h3>
          </div>
          <button
            type="button"
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              onPick(null);
              onClose();
            }}
            className={cn(
              "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
              !activeSet ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-3">
              <span className={cn("w-2.5 h-2.5 rounded-full", !activeSet ? "bg-white" : "bg-gray-300")} />
              <div className="font-bold">{allLabel}</div>
            </div>
            {!activeSet ? <Check size={18} className="opacity-90" /> : null}
          </button>

          {sets.map((s) => {
            const theme = getSetTheme(s.color);
            const isActive = activeSet === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onPick(s.id);
                  onClose();
                }}
                className={cn(
                  "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                  isActive ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn("w-2.5 h-2.5 rounded-full", isActive ? "bg-white" : theme.bg)} />
                  <div className="min-w-0">
                    <div className={cn("font-bold truncate", isActive ? "text-white" : "text-gray-900")}>
                      {s.label}
                    </div>

                    <MembersPreview members={s.members} inverted={isActive} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {s.count > 0 ? (
                    <span
                      className={cn(
                        "text-[11px] px-2 py-1 rounded-full",
                        isActive ? "bg-white/15 text-white" : "bg-gray-100 text-gray-600 border border-gray-200"
                      )}
                    >
                      {s.count}
                    </span>
                  ) : null}
                  {isActive ? <Check size={18} className="opacity-90" /> : null}
                </div>
              </button>
            );
          })}
        </div>

        {onNewSet ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewSet();
            }}
            className="w-full mt-5 py-3 rounded-xl font-bold text-sm border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            New Set
          </button>
        ) : null}

        <button type="button" onClick={onClose} className="w-full mt-3 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
          Cancel
        </button>
      </div>
    </div>
  );
}
