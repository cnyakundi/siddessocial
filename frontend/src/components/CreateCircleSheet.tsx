"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, Users, X } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES } from "@/src/lib/sides";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";
import { toast } from "@/src/lib/toast";
import { normalizeHandle } from "@/src/lib/mentions";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function parseMembers(raw: string): string[] {
  const parts = String(raw || "")
    .split(/[\n,]+/g)
    .map((s) => normalizeHandle(s))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function sideLabel(side: SideId): string {
  if (side === "public") return "Public";
  if (side === "friends") return "Friends";
  if (side === "close") return "Close";
  if (side === "work") return "Work";
  return "Friends";
}

/**
 * sd_806: WhatsApp-simple Circle creation
 * - Step 1: Add people (optional)
 * - Step 2: Name the circle (required)
 * No side picker. No theme picker. No advanced settings.
 */
export function CreateCircleSheet(props: {
  open: boolean;
  onClose: () => void;

  // Existing prop API preserved for compatibility (callers can still pass these)
  advanced?: boolean;
  canWrite: boolean;
  creating: boolean;
  err: string | null;

  label: string;
  setLabel: (v: string) => void;

  side: SideId;
  setSide: (v: SideId) => void;

  // Color props preserved, but UI doesn't expose a selector.
  color: any;
  setColor: (v: any) => void;

  membersRaw: string;
  setMembersRaw: (v: string) => void;

  onCreate: (label: string, membersRaw: string, side: SideId, color?: any) => Promise<any>;
}) {
  const { open, onClose, canWrite, creating, err, label, setLabel, side, membersRaw, setMembersRaw, onCreate } = props;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useLockBodyScroll(open && mounted);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open: open && mounted, containerRef: panelRef, initialFocusRef: closeBtnRef });

  const [step, setStep] = useState<0 | 1>(0);
  useEffect(() => {
    if (!open) return;
    setStep(0);
  }, [open]);

  // Keep color auto-aligned to the Side (no user choice in simple mode).
  useEffect(() => {
    if (!open) return;
    try {
      // Best-effort mapping to existing theme keys.
      if (side === "friends") props.setColor("emerald");
      else if (side === "close") props.setColor("rose");
      else if (side === "work") props.setColor("slate");
      else if (side === "public") props.setColor("blue");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, side]);

  const members = useMemo(() => parseMembers(membersRaw), [membersRaw]);
  const memberCount = members.length;

  const nextDisabled = !canWrite || creating; // members optional
  const createDisabled = !canWrite || creating || !String(label || "").trim();

  const theme = SIDE_THEMES[side] || SIDE_THEMES.friends;

  const doCreate = async () => {
    if (createDisabled) return;
    try {
      await onCreate(String(label || "").trim(), membersRaw, side, props.color);
      // Close after success (safe across different callers).
      try { onClose(); } catch {}
    } catch (e: any) {
      const msg = e?.message || "Create failed.";
      toast(msg, { variant: "error" });
    }
  };

  if (!open || !mounted) return null;

  const title = step === 0 ? "Add people" : "Name circle";

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close circle creation"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onPointerDown={(e) => {
          // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click/touch)
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="create-circle-title"
        className={cn(
          "relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200",
          "max-h-[75dvh] md:max-h-[80vh] overflow-y-auto overscroll-contain",
          err ? "ring-2 ring-red-500" : null
        )}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className={cn("w-9 h-9 rounded-xl bg-white border flex items-center justify-center shadow-sm", theme.text)}>
                <Users size={18} />
              </div>
              <div className="min-w-0">
                <h3 id="create-circle-title" className="text-lg font-black text-gray-900 truncate">{title}</h3>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Inside <span className={cn("font-bold", theme.text)}>{sideLabel(side)}</span>
                </div>
              </div>
            </div>
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

        {step === 0 ? (
          <div>
            <div className="text-sm font-bold text-gray-900">People</div>
            <div className="text-xs text-gray-500 mt-1">
              Add @handles separated by commas or new lines. (Optional — you can add people later.)
            </div>

            <textarea
              value={membersRaw}
              onChange={(e) => setMembersRaw(e.target.value)}
              placeholder="@alex, @nina, @mike"
              className="w-full mt-3 p-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 min-h-[120px]"
              disabled={!canWrite || creating}
            />

            <div className="mt-2 text-[11px] text-gray-500">
              {memberCount ? (
                <span className="font-semibold text-gray-700">{memberCount} selected</span>
              ) : (
                <span>No one added yet.</span>
              )}
            </div>

            {err ? <div className="mt-3 text-sm text-red-600 font-semibold">{err}</div> : null}

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-gray-200 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={nextDisabled}
                onClick={() => setStep(1)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl font-black text-sm border inline-flex items-center justify-center gap-2",
                  nextDisabled ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
                )}
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="mt-4">
              <div className="text-sm font-bold text-gray-900">Circle name</div>
              <div className="text-xs text-gray-500 mt-1">
                Only people in this circle will see posts sent here.
              </div>

              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Football, Family, Project A"
                className="w-full mt-3 p-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
                disabled={!canWrite || creating}
              />
            </div>

            {err ? <div className="mt-3 text-sm text-red-600 font-semibold">{err}</div> : null}

            <button
              type="button"
              disabled={createDisabled}
              onClick={() => void doCreate()}
              className={cn(
                "w-full mt-5 py-2.5 rounded-xl font-black text-sm border flex items-center justify-center gap-2",
                createDisabled ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
              )}
            >
              <Check size={16} />
              {creating ? "Creating..." : "Create circle"}
            </button>

            <div className="mt-3 text-[11px] text-gray-500">
              {memberCount ? (
                <span>
                  Includes <span className="font-semibold text-gray-700">{memberCount}</span> people.
                </span>
              ) : (
                <span>You can add people later.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
