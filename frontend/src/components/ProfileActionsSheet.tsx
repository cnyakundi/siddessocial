"use client";


// sd_762_compact_other_sheets_max_height
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { Ban, Flag, Link2, VolumeX, X, Copy } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

async function copyText(text: string): Promise<boolean> {
  const t = String(text || "");
  if (!t) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {}

  try {
    const ta = document.createElement("textarea");
    ta.value = t;
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

export function ProfileActionsSheet(props: {
  open: boolean;
  onClose: () => void;
  handle: string;
  displayName?: string;
  href?: string;
  isOwner?: boolean;
}) {
  const { open, onClose, handle, displayName, href, isOwner } = props;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);


  useLockBodyScroll(open && mounted);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open: open && mounted, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  if (!open || !mounted) return null;

  const who = String(handle || "").trim();
  const name = String(displayName || who || "User").trim();

  const absUrl = (() => {
    if (href) return href;
    if (typeof window === "undefined") return "";
    return window.location.href;
  })();

  const doCopyLink = async () => {
    const ok = await copyText(absUrl);
    toast[ok ? "success" : "error"](ok ? "Link copied." : "Could not copy link.");
    onClose();
  };

  const doCopyHandle = async () => {
    const ok = await copyText(who);
    toast[ok ? "success" : "error"](ok ? "Handle copied." : "Could not copy.");
    onClose();
  };

  const doReport = async () => {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "user", targetId: who, reason: "other" }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not report.";
        throw new Error(msg);
      }
      toast.success("Reported. Thank you.");
      onClose();
    } catch (e) {
      toast.error((e as any)?.message || "Could not report.");
    }
  };

  const doMute = async () => {
    if (!who) return;
    if (typeof window !== "undefined" && !window.confirm("Mute " + name + "? You won't see their posts in your feed.")) return;

    try {
      const res = await fetch("/api/mutes", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: who }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not mute.";
        throw new Error(msg);
      }
      toast.success("Muted " + name + ".");
      onClose();
    } catch (e) {
      toast.error((e as any)?.message || "Could not mute.");
    }
  };

  const doBlock = async () => {
    if (!who) return;
    if (typeof window !== "undefined" && !window.confirm("Block " + name + "? You won't see each other.")) return;

    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: who }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not block.";
        throw new Error(msg);
      }
      toast.success("Blocked " + name + ".");
      onClose();
    } catch (e) {
      toast.error((e as any)?.message || "Could not block.");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[98] flex items-end justify-center md:items-center" data-testid="profile-actions-sheet">
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
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="profile-actions-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200 max-h-[70dvh] md:max-h-[80vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <div id="profile-actions-title" className="text-sm font-extrabold text-gray-900 truncate">Profile options</div>
            <div className="text-xs text-gray-500 truncate">{name} {who}</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-2">
          <button type="button" onClick={doCopyLink} className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm"><Link2 size={18} /></div>
            <div>
              <div className="font-bold text-gray-900">Copy link</div>
              <div className="text-xs text-gray-500">Share profile</div>
            </div>
          </button>

          <button type="button" onClick={doCopyHandle} className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm"><Copy size={18} /></div>
            <div>
              <div className="font-bold text-gray-900">Copy handle</div>
              <div className="text-xs text-gray-500">Copy {who}</div>
            </div>
          </button>
          {!isOwner ? (
            <>

          <button type="button" onClick={doReport} className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm"><Flag size={18} /></div>
            <div>
              <div className="font-bold text-gray-900">Report user</div>
              <div className="text-xs text-gray-500">Flag abuse or spam</div>
            </div>
          </button>

          <button type="button" onClick={doMute} className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm"><VolumeX size={18} /></div>
            <div>
              <div className="font-bold text-gray-900">Mute user</div>
              <div className="text-xs text-gray-500">Hide their posts from your feed</div>
            </div>
          </button>

          <button type="button" onClick={doBlock} className="w-full p-4 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center gap-4 text-left border border-rose-200">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-rose-700 shadow-sm border border-rose-200"><Ban size={18} /></div>
            <div>
              <div className="font-bold text-rose-700">Block user</div>
              <div className="text-xs text-rose-700/80">Hard stop: no view, no messages</div>
            </div>
          </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
    , document.body
  );
}
