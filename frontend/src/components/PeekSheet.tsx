"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { toast } from "@/src/lib/toast";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function excerpt(s: string, n = 90) {
  const t = (s || "").trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

type PeekPost = {
  id: string;
  author?: string;
  handle?: string;
  time?: string;
  content?: string;
  text?: string;
};

type FeedResp = {
  ok?: boolean;
  restricted?: boolean;
  side?: string;
  count?: number;
  items?: PeekPost[];
  error?: string;
};

export function PeekSheet({ open, onClose, sideId }: { open: boolean; onClose: () => void; sideId: SideId }) {
  const router = useRouter();
  const theme = SIDE_THEMES[sideId];
  const meta = SIDES[sideId];

  const [loading, setLoading] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<PeekPost[]>([]);

  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  useEffect(() => {
    if (!open) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      setRestricted(false);

      try {
        const res = await fetch(`/api/feed?side=${encodeURIComponent(sideId)}`, { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as FeedResp | null;
        if (!alive) return;

        if (!res.ok) {
          setErr(String((j as any)?.error || "failed"));
          setItems([]);
          return;
        }

        const r = Boolean(j?.restricted);
        setRestricted(r);

        const arr = Array.isArray(j?.items) ? (j?.items as PeekPost[]) : [];
        setItems(arr.slice(0, 2));
      } catch {
        if (!alive) return;
        setErr("network_error");
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, sideId]);

  const viewItems = useMemo(() => items ?? [], [items]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-black/30 backdrop-blur-sm" onPointerDown={(e) => {
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
      }} aria-label="Close peek" />
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="peek-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-4">
          <div id="peek-title" className={cn("font-bold", theme.text)}>Peeking into {meta.label}</div>
          <button type="button" ref={closeBtnRef} onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {loading ? (
            <div className="p-6 text-center text-gray-400">Loading…</div>
          ) : err ? (
            <div className="p-6 text-center text-gray-400">Peek unavailable ({err}).</div>
          ) : restricted ? (
            <div className="p-6 text-center text-gray-400">Sign in to peek.</div>
          ) : viewItems.length ? (
            viewItems.map((p) => {
              const content = String((p as any).content || (p as any).text || "");
              return (
                <div key={p.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span className="font-bold text-gray-700">{p.author || p.handle || "Someone"}</span>
                    <span>{p.time || ""}</span>
                  </div>
                  <div className="text-sm text-gray-800">“{excerpt(content)}”</div>
                  <button
                    type="button"
                    className={cn("mt-2 text-xs font-bold", theme.text, "hover:underline")}
                    onClick={() => {
                      if (!p.id) return toast("Missing post id");
                      router.push(`/siddes-post/${encodeURIComponent(p.id)}?reply=1`);
                    }}
                  >
                    Reply
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-gray-400">Nothing new here yet.</div>
          )}
        </div>

        <button type="button" onClick={onClose} className="w-full py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
          Close Peek
        </button>
      </div>
    </div>
  );
}
