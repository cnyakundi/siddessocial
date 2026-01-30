"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Users, X } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * sd_809: Circles creation must NOT feel like admin work.
 * - Only required field: Name
 * - Optional: Add people (collapsed by default)
 * - Side is context (no picker)
 * - Theme is derived from Side (no picker)
 */
export function CreateCircleSheet(props: {
  open: boolean;
  onClose: () => void;

  // Compatibility: callers may pass advanced; we use it only to expand People section by default.
  advanced?: boolean;

  canWrite: boolean;
  creating: boolean;
  err?: string | null;

  label: string;
  setLabel: (v: string) => void;

  side: SideId;
  setSide: (v: SideId) => void;

  // Keep 'any' to survive setThemes/circleThemes migrations without type wars.
  color: any;
  setColor: (v: any) => void;

  membersRaw: string;
  setMembersRaw: (v: string) => void;

  onCreate: (label: string, membersRaw: string, side: SideId, color?: any) => Promise<any>;
}) {
  const {
    open,
    onClose,
    advanced = false,
    canWrite,
    creating,
    err,
    label,
    setLabel,
    side,
    setSide,
    color,
    setColor,
    membersRaw,
    setMembersRaw,
    onCreate,
  } = props;

  const [showPeople, setShowPeople] = useState<boolean>(!!advanced);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  useEffect(() => {
    if (!open) return;
    setLocalErr(null);
    setShowPeople(!!advanced);

    // Auto-align color to Side (no theme picker).
    try {
      if (side === "public") setColor("blue");
      else if (side === "friends") setColor("emerald");
      else if (side === "close") setColor("rose");
      else if (side === "work") setColor("slate");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => onClose();

  const createEnabled = useMemo(() => {
    if (!canWrite) return false;
    if (creating) return false;
    return Boolean(String(label || "").trim());
  }, [canWrite, creating, label]);

  const sideTheme = SIDE_THEMES[side] || SIDE_THEMES.friends;
  const sideLabel = SIDES[side]?.label ?? side;

  const createNow = async () => {
    if (!createEnabled) return;
    setLocalErr(null);
    try {
      await onCreate(String(label || "").trim(), membersRaw, side, color);
      close();
    } catch (e: any) {
      setLocalErr(e?.message || "Create failed.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center md:items-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onPointerDown={(e) => {
          // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click)
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          close();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          close();
        }}
        aria-label="Close"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="create-circle-title"
        className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div id="create-circle-title" className="text-sm font-black text-gray-900">New Circle</div>
              <div className="text-[11px] text-gray-500 mt-1">Name it. Add people now or later.</div>
            </div>

            <button
              type="button"
              ref={closeBtnRef}
              onClick={close}
              className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Context preview (read-only) */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn("h-8 w-8 rounded-full border flex-shrink-0", sideTheme.border, sideTheme.lightBg)} aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Side</div>
                <div className="text-sm font-extrabold text-gray-900 truncate">{sideLabel}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPeople((v) => !v)}
              className={cn(
                "px-3 py-2 rounded-2xl border text-sm font-bold inline-flex items-center gap-2",
                "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
              )}
              aria-expanded={showPeople}
            >
              <ChevronDown size={16} className={cn("transition-transform", showPeople ? "rotate-180" : "rotate-0")} />
              {showPeople ? "Hide people" : "Add people"}
            </button>
          </div>
        </div>

        {/* Errors */}
        {!canWrite ? (
          <div className="px-4 pt-4">
            <div className="p-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
              <div className="font-bold">Create disabled (read-only)</div>
              <div className="text-xs mt-1">
                Circle creation is enforced server-side. If you do not have permission, you will see an error.
              </div>
            </div>
          </div>
        ) : null}

        {(localErr || err) ? (
          <div className="px-4 pt-4">
            <div className="p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
              <div className="font-bold">Error</div>
              <div className="text-xs mt-1">{localErr || err}</div>
            </div>
          </div>
        ) : null}

        {/* Body */}
        <div className="px-4 py-4">
          <div>
            <div className="text-sm font-bold text-gray-900 mb-2">Name</div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Weekend Crew"
              autoFocus
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
            />
            <div className="text-[11px] text-gray-500 mt-2">
              This Circle will be created inside <span className="font-bold">{sideLabel}</span>.
            </div>
          </div>

          {showPeople ? (
            <div className="mt-4">
              <div className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Users size={16} />
                People (optional)
              </div>
              <textarea
                value={membersRaw}
                onChange={(e) => setMembersRaw(e.target.value)}
                placeholder="@sarah, @marc_us
@elena"
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
              />
              <div className="text-[11px] text-gray-400 mt-1">
                Comma or newline separated. We auto-add “@”. You can add people later.
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!createEnabled}
            onClick={() => void createNow()}
            className={cn(
              "w-full mt-5 py-2.5 rounded-xl font-bold text-sm border flex items-center justify-center gap-2",
              !createEnabled
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
            )}
          >
            <Check size={16} />
            {creating ? "Creating..." : "Create circle"}
          </button>
        </div>
      </div>
    </div>
  );
}
