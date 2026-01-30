"use client";

import { useRef } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";
import { Copy, History, Mail, MoreHorizontal, Settings, Trash2, X } from "lucide-react";
import { toast } from "@/src/lib/toast";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

export function CircleHubMoreSheet({
  open,
  onClose,
  setId,
  setLabel,
  isOwner,
  canWrite,
  onOpenInvites,
  onOpenSettings,
  onOpenHistory,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  setId: string;
  setLabel?: string | null;
  isOwner: boolean;
  canWrite: boolean;
  onOpenInvites: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onDelete: () => void;
}) {
  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  if (!open) return null;

  const copyId = async () => {
    const ok = await copyText(setId);
    toast[ok ? "success" : "error"](ok ? "Circle ID copied." : "Could not copy.");
  };

  const ownerDisabled = isOwner && !canWrite;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onPointerDown={(e) => {
          // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click)
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
        aria-label="Close"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="sethub-more-title"
        className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-5 border border-gray-200 animate-in slide-in-from-bottom-full duration-200"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div id="sethub-more-title" className="text-sm font-black text-gray-900 flex items-center gap-2">
              <MoreHorizontal size={16} className="text-gray-400" />
              More
            </div>
            {setLabel ? <div className="text-[11px] text-gray-500 mt-1 truncate">{setLabel}</div> : null}
          </div>
          <button
            type="button"
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Close"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenHistory();
            }}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-left flex items-center gap-3"
          >
            <History size={18} className="text-gray-500" />
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-gray-900">History</div>
              <div className="text-[11px] text-gray-500">Changes, membership events</div>
            </div>
          </button>

          {isOwner ? (
            <>
              <button
                type="button"
                disabled={ownerDisabled}
                onClick={() => {
                  if (ownerDisabled) return;
                  onClose();
                  onOpenInvites();
                }}
                className={cn(
                  "w-full px-4 py-3 rounded-2xl border text-left flex items-center gap-3",
                  ownerDisabled
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white hover:bg-gray-50 border-gray-200"
                )}
              >
                <Mail size={18} className={cn(ownerDisabled ? "text-gray-300" : "text-gray-500")} />
                <div className="min-w-0">
                  <div className="text-sm font-extrabold">Invites</div>
                  <div className="text-[11px] opacity-80">Invite more people</div>
                </div>
              </button>

              <button
                type="button"
                disabled={ownerDisabled}
                onClick={() => {
                  if (ownerDisabled) return;
                  onClose();
                  onOpenSettings();
                }}
                className={cn(
                  "w-full px-4 py-3 rounded-2xl border text-left flex items-center gap-3",
                  ownerDisabled
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white hover:bg-gray-50 border-gray-200"
                )}
              >
                <Settings size={18} className={cn(ownerDisabled ? "text-gray-300" : "text-gray-500")} />
                <div className="min-w-0">
                  <div className="text-sm font-extrabold">Settings</div>
                  <div className="text-[11px] opacity-80">Name, Side, Theme</div>
                </div>
              </button>
            </>
          ) : null}

          <div className="p-3 rounded-2xl border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-widest text-gray-500">Details</div>
                <div className="text-[11px] text-gray-700 font-mono truncate mt-1" title={setId}>
                  {setId}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyId()}
                className="px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 flex items-center gap-2"
              >
                <Copy size={14} />
                Copy
              </button>
            </div>
            {ownerDisabled ? (
              <div className="mt-2 text-[11px] text-gray-500">
                Read-only: owner actions are disabled in this viewer context.
              </div>
            ) : null}
          </div>

          {isOwner ? (
            <button
              type="button"
              disabled={ownerDisabled}
              onClick={() => {
                if (ownerDisabled) return;
                onClose();
                onDelete();
              }}
              className={cn(
                "w-full px-4 py-3 rounded-2xl border text-left flex items-center gap-3",
                ownerDisabled
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white hover:bg-red-50 border-red-200 text-red-700"
              )}
            >
              <Trash2 size={18} className={cn(ownerDisabled ? "text-gray-300" : "text-red-600")} />
              <div className="min-w-0">
                <div className="text-sm font-extrabold">Delete Set</div>
                <div className="text-[11px] opacity-80">Permanent</div>
              </div>
            </button>
          ) : null}
        </div>

        <button type="button" onClick={onClose} className="mt-4 w-full py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
          Close
        </button>
      </div>
    </div>
  );
}
