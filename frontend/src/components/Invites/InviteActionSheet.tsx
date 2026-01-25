"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { X } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import type { SetInvite } from "@/src/lib/inviteProvider";
import { getInviteProvider } from "@/src/lib/inviteProvider";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeHandle(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (t.startsWith("@")) return t;
  return `@${t.replace(/^@+/, "")}`;
}

export function InviteActionSheet({
  open,
  onClose,
  setId,
  side,
  prefillTo,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  setId: string;
  side: SideId;
  prefillTo?: string;
  onCreated: (invite: SetInvite) => void;
}) {
  const invites = useMemo(() => getInviteProvider(), []);
  const [toRaw, setToRaw] = useState(prefillTo || "@jordan");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose: close });

  useEffect(() => {
    if (!open) return;
    const p = (prefillTo || "").trim();
    if (p) setToRaw(p);
  }, [open, prefillTo]);

  const close = () => {
    setErr(null);
    setBusy(false);
    onClose();
  };

  const send = async () => {
    const to = normalizeHandle(toRaw);
    if (!to) {
      setErr("Enter a handle like @jordan");
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const inv = await invites.create({ setId, side, to, message });
      onCreated(inv);
      close();
    } catch (e: any) {
      setErr(e?.message || "Invite failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99] flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} aria-label="Close" />
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="invite-actions-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div id="invite-actions-title" className="font-black text-gray-900">Invite more to this Set</div>
          <button type="button" ref={closeBtnRef} onClick={close} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          {err ? (
            <div className="mb-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
              <div className="font-bold">Error</div>
              <div className="text-xs mt-1">{err}</div>
            </div>
          ) : null}

          <div className="mb-3">
            <div className="text-xs font-bold text-gray-700 mb-1">Recipient</div>
            <input
              value={toRaw}
              onChange={(e) => setToRaw(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
              placeholder="@jordan"
              autoFocus
            />
          </div>

          <div className="mb-4">
            <div className="text-xs font-bold text-gray-700 mb-1">Message (optional)</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-h-[84px] px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
              placeholder="Come join this Set"
            />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void send()}
            className={cn(
              "w-full py-3 rounded-full font-black",
              busy ? "bg-gray-100 text-gray-400" : "bg-gray-900 text-white hover:opacity-95"
            )}
          >
            {busy ? "Sending…" : "Send invite"}
          </button>

          <div className="text-[11px] text-gray-400 mt-3">Invites are enforced server-side. If you do not have permission, you will see an error.</div>
        </div>
      </div>
    </div>
  );
}
