"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, User } from "lucide-react";

type TabId = "likes" | "echoes" | "replies";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function FaceRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
        <User size={14} />
      </div>
      <div className="text-sm font-medium text-gray-900">{label}</div>
    </div>
  );
}

export function SignalsSheet({
  open,
  onClose,
  totalSignals,
}: {
  open: boolean;
  onClose: () => void;
  totalSignals: number;
}) {
  const [tab, setTab] = useState<TabId>("likes");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setTab("likes");
  }, [open]);

  const list = useMemo(() => {
    const base = tab === "likes" ? "Sider" : tab === "echoes" ? "Echoer" : "Replier";
    return [1, 2, 3].map((i) => `${base} ${i}`);
  }, [tab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close signals sheet"
      />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-gray-900">{totalSignals} Signals</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex border-b border-gray-100 mb-4">
          {(["likes", "echoes", "replies"] as TabId[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 pb-3 text-sm font-bold capitalize transition-colors border-b-2",
                tab === t
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="h-48 overflow-y-auto">
          {list.map((name) => (
            <FaceRow key={name} label={name} />
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl"
        >
          Close
        </button>
      </div>
    </div>
  );
}
