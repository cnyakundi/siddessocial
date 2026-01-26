"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { LogOut, User, Sparkles, Link as LinkIcon, Grid3X3, FileText } from "lucide-react";
import { clearPrivateClientCaches } from "@/src/lib/privateClientCaches";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function DesktopUserMenu({
  open,
  onClose,
  align = "right",
}: {
  open: boolean;
  onClose: () => void;
  align?: "right" | "left";
}) {
  useLockBodyScroll(open);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLAnchorElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: firstItemRef, onClose });


  if (!open) return null;

  const onLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      // Paranoia: clear private client caches before leaving the session.
      clearPrivateClientCaches();
      window.location.href = "/login";
    }
  };

  return (
    <>
      <button type="button" className="fixed inset-0 z-[210]" onClick={onClose} aria-label="Close user menu" />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="desktop-user-menu-title" tabIndex={-1}
        className={cn(
          "absolute top-12 z-[220] w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden",
          align === "right" ? "right-0" : "left-0"
        )}
      >
        <div className="p-3 border-b border-gray-100">
          <div id="desktop-user-menu-title" className="text-sm font-extrabold text-gray-900">Account</div>
          <div className="text-xs text-gray-500">Quick actions</div>
        </div>

        <div className="p-2">
          <Link href="/siddes-profile" ref={firstItemRef} className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <User size={16} className="text-gray-500" /> Me
          </Link>
          <Link href="/siddes-profile/prism" className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <Sparkles size={16} className="text-gray-500" /> Prism Identity
          </Link>
          <Link href="/siddes-profile/account" className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <FileText size={16} className="text-gray-500" /> Account
          </Link>
          <Link href="/siddes-sets" className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <Grid3X3 size={16} className="text-gray-500" /> Sets
          </Link>
          <Link href="/siddes-invites" className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <LinkIcon size={16} className="text-gray-500" /> Invites
          </Link>
</div>

        <div className="p-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-red-50 text-sm font-extrabold text-red-600"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </div>
    </>
  );
}

