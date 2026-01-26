"use client";


// sd_764_fix_icon_tap_targets_44px
import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import type { ToastItem } from "@/src/lib/toast";
import { toast } from "@/src/lib/toast";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function Icon({ v }: { v: ToastItem["variant"] }) {
  if (v === "success") return <CheckCircle2 size={18} className="text-green-700" />;
  if (v === "error") return <AlertTriangle size={18} className="text-red-700" />;
  return <Info size={18} className="text-gray-700" />;
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const evt = useMemo(() => toast.eventName(), []);

  useEffect(() => {
    const onToast = (e: Event) => {
      const ce = e as CustomEvent<ToastItem>;
      const it = ce.detail;
      if (!it || !it.id) return;

      setItems((cur) => [it, ...cur].slice(0, 4));

      const t = window.setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== it.id));
      }, Math.max(1200, it.durationMs || 4200));

      return () => window.clearTimeout(t);
    };

    window.addEventListener(evt, onToast as any);
    return () => window.removeEventListener(evt, onToast as any);
  }, [evt]);

  if (!items.length) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[200]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)" }}
      aria-live="polite"
      aria-relevant="additions text"
      data-testid="toast-host"
    >
      <div className="max-w-2xl mx-auto px-4 flex flex-col gap-2">
        {items.map((it) => (
          <div
            key={it.id}
            className={cn(
              "bg-white/95 backdrop-blur border border-gray-200 shadow-lg rounded-2xl px-3 py-2 flex items-start gap-3"
            )}
          >
            <div className="pt-1">
              <Icon v={it.variant} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{it.message}</div>

              {it.actionLabel && it.onAction ? (
                <button
                  type="button"
                  className="mt-2 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-gray-900 text-white hover:opacity-90"
                  onClick={() => {
                    try {
                      it.onAction?.();
                    } finally {
                      setItems((cur) => cur.filter((x) => x.id !== it.id));
                    }
                  }}
                >
                  {it.actionLabel}
                </button>
              ) : null}
            </div>

            <button
              type="button"
              aria-label="Dismiss"
              className="min-w-[44px] min-h-[44px] p-2 rounded-lg hover:bg-gray-100 text-gray-500 inline-flex items-center justify-center"
              onClick={() => setItems((cur) => cur.filter((x) => x.id !== it.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
