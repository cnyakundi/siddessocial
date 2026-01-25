"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function DesktopSearchOverlay({
  open,
  onClose,
  placeholder,
}: {
  open: boolean;
  onClose: () => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [q, setQ] = useState("");
  const router = useRouter();

  useLockBodyScroll(open);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: inputRef });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-center p-4 md:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close search"
      />

      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-label="Search" className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500">
            <Search size={18} />
          </div>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const qq = String(q || "").trim();
                if (qq.length > 0) {
                  router.push(`/search?q=${encodeURIComponent(qq)}&tab=posts`);
                  onClose();
                }
              }
            }}
            placeholder={placeholder || "Search…"}
            className="flex-1 bg-transparent outline-none text-sm font-semibold text-gray-900 placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <div className="text-xs font-extrabold uppercase tracking-widest text-gray-400 mb-2">Search</div>
          <div className="text-sm text-gray-600 leading-relaxed">
            <span className="font-bold text-gray-900">Coming next:</span> unified search across Posts, Sets, and People.
            Press Enter to open results.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "@mentions",
              "my sets",
              "work docs",
              "today",
              "links",
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setQ(chip)}
                className={cn(
                  "px-3 py-2 rounded-full border text-sm font-bold",
                  "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                )}
              >
                {chip}
              </button>
            ))}
          </div>

          {q ? (
            <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-600">
              Typed: <span className="font-bold text-gray-900">{q}</span>
              <span className="block mt-1 text-[11px] text-gray-400">(Wire this to /search when you implement it.)</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
