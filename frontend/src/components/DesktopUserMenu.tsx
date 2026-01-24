"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { LogOut, Settings, User, Link as LinkIcon, Grid3X3, FileText } from "lucide-react";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const prismEnabled = process.env.NODE_ENV !== "production"; // Prism is DEV-only until backed by real server profile/personas

  const onLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <>
      <button type="button" className="fixed inset-0 z-[210]" onClick={onClose} aria-label="Close user menu" />

      <div
        className={cn(
          "absolute top-12 z-[220] w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden",
          align === "right" ? "right-0" : "left-0"
        )}
      >
        <div className="p-3 border-b border-gray-100">
          <div className="text-sm font-extrabold text-gray-900">Account</div>
          <div className="text-xs text-gray-500">Quick actions</div>
        </div>

        <div className="p-2">
          <Link href="/siddes-profile" className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <User size={16} className="text-gray-500" /> {prismEnabled ? "Prism Profile" : "Profile"}
          </Link>
          <Link href="/siddes-profile/account" className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <FileText size={16} className="text-gray-500" /> Account &amp; session
          </Link>
          <Link href="/siddes-sets" className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <Grid3X3 size={16} className="text-gray-500" /> Sets
          </Link>
          <Link href="/siddes-invites" className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <LinkIcon size={16} className="text-gray-500" /> Invites
          </Link>
          <Link href="/siddes-profile/account" className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-700">
            <Settings size={16} className="text-gray-500" /> Settings
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
