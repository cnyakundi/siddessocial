"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { X } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function EditPostSheet({
  open,
  onClose,
  postId,
  initialText,
  maxLen,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  initialText: string;
  maxLen?: number;
  onSaved: (nextText: string, editedAtMs?: number | null) => void;
}) {
  const [text, setText] = useState(initialText || "");
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);


  useLockBodyScroll(open && mounted);

  const panelRef = useRef<HTMLDivElement | null>(null);
  useDialogA11y({ open: open && mounted, containerRef: panelRef, initialFocusRef: taRef, onClose });

  const limit = useMemo(() => {
    const n = Number(maxLen || 0);
    return Number.isFinite(n) && n > 0 ? n : 5000;
  }, [maxLen]);

  useEffect(() => {
    if (!open) return;
    setText(initialText || "");
    const t = setTimeout(() => {
      try {
        taRef.current?.focus();
      } catch {}
    }, 50);
    return () => clearTimeout(t);
  }, [open, initialText]);

  if (!open || !mounted) return null;

  const trimmed = String(text || "").trim();
  const canSave = !busy && trimmed.length > 0 && trimmed.length <= limit;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/post/${encodeURIComponent(postId)}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j || j.ok !== true) {
        const msg = String(j?.error || "update_failed");
        throw new Error(msg);
      }
      const editedAt = typeof j?.post?.editedAt === "number" ? Number(j.post.editedAt) : null;
      onSaved(trimmed, editedAt);
      toast.success("Post updated.");
      onClose();
    } catch (e: any) {
      const msg = String(e?.message || "Could not update.");
      toast.error(msg === "edit_window_closed" ? "Edit window closed." : msg);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center md:items-center">
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
        aria-label="Close edit"
      />
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="edit-post-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-extrabold text-gray-900">Edit post</div>
            <div className="text-xs text-gray-500 mt-1">Keep it honest. Public edits are time-limited.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full min-h-[140px] rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 outline-none focus:bg-white focus:border-gray-300"
          maxLength={limit}
        />

        <div className="mt-2 flex items-center justify-between">
          <div className={cn("text-[11px] font-bold", trimmed.length > limit ? "text-rose-600" : "text-gray-400")}>
            {trimmed.length}/{limit}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-extrabold text-white",
              canSave ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"
            )}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
    , document.body
  );
}
