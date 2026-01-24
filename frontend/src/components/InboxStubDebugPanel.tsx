"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bug, RotateCcw, Save, X } from "lucide-react";

/**
 * InboxStubDebugPanel
 *
 * Dev-only helper for the inbox backend_stub.
 * - Lets you set a stub viewer id (stored in cookie `sd_viewer`).
 * - The provider forwards it via `x-sd-viewer` header (dev-only) to the Next proxy.
 *
 * IMPORTANT Siddes law:
 * - We NEVER send viewer identity via URL query params.
 *   Use header/cookie only.
 *
 * Props are OPTIONAL so pages can render <InboxStubDebugPanel /> without wiring.
 * (Some pages pass viewer/onViewer; others don't.)
 */
export type InboxStubDebugPanelProps = {
  viewer?: string;
  onViewer?: (v: string) => void;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const parts = document.cookie ? document.cookie.split(";") : [];
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("=") || "");
  }
  return "";
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  // Lax is fine for dev-only stub viewer.
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function InboxStubDebugPanel(props: { viewer: string; onViewer: (v: string) => void }) {
  // Dev-only panel: wrapper avoids conditional-hook lint in production builds.
  if (process.env.NODE_ENV === "production") return null;
  return <InboxStubDebugPanelInner {...props} />;
}

function InboxStubDebugPanelInner({ viewer, onViewer }: InboxStubDebugPanelProps = {}) {
  const router = useRouter();
  const sp = useSearchParams();

  // Never show in production builds.
  const debugOn = sp.get("debug") === "1";

  const [cookieViewer, setCookieViewer] = useState<string>("");

  // Read cookie on mount + whenever debug toggles (simple re-sync).
  useEffect(() => {
    setCookieViewer(getCookie("sd_viewer"));
  }, [debugOn]);

  const enabled = debugOn || Boolean(cookieViewer);
  const [open, setOpen] = useState(enabled);

  useEffect(() => {
    if (enabled) setOpen(true);
  }, [enabled]);

  const viewerHint = String(viewer || "").trim();
  const [draft, setDraft] = useState(viewerHint || cookieViewer);

  useEffect(() => {
    // Prefer the prop hint if provided, else cookie.
    setDraft(viewerHint || cookieViewer);
  }, [viewerHint, cookieViewer]);

  const canApply = useMemo(() => {
    const v = draft.trim();
    return v.length === 0 || /^[a-zA-Z0-9_-]{2,64}$/.test(v);
  }, [draft]);

  const apply = () => {
    const v = draft.trim();
    if (v) setCookie("sd_viewer", v);
    else clearCookie("sd_viewer");

    setCookieViewer(v);
    onViewer?.(v);

    // Refresh current route without query-param identity
    try {
      router.refresh();
    } catch {}
  };

  const reset = () => {
    clearCookie("sd_viewer");
    setCookieViewer("");
    setDraft("");
    onViewer?.("");
    try {
      router.refresh();
    } catch {}
  };

  if (!enabled) {
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 text-xs font-extrabold px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          title="Open inbox debug tools"
        >
          <Bug size={14} className="text-gray-500" />
          Debug
        </button>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="mb-4 p-4 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-xs font-extrabold text-gray-700 flex items-center gap-2">
          <Bug size={14} className="text-gray-500" />
          Inbox debug
          <span className="text-gray-300">•</span>
          <span className="text-gray-500 font-bold">sd_viewer</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-2 rounded-full hover:bg-gray-100"
          aria-label="Close debug panel"
          title="Close"
        >
          <X size={16} className="text-gray-500" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="viewer id (dev only)"
          className={cn(
            "flex-1 px-3 py-2 rounded-xl border text-sm outline-none",
            canApply ? "border-gray-200 focus:border-gray-300" : "border-red-200 focus:border-red-300"
          )}
          aria-label="Stub viewer id"
        />
        <button
          type="button"
          onClick={apply}
          disabled={!canApply}
          className="inline-flex items-center gap-2 text-xs font-extrabold px-3 py-2 rounded-full bg-gray-900 text-white hover:opacity-90 disabled:opacity-40"
          title="Apply viewer cookie"
        >
          <Save size={14} />
          Apply
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 text-xs font-extrabold px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          title="Reset viewer cookie"
        >
          <RotateCcw size={14} className="text-gray-500" />
          Reset
        </button>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Visible only in dev. Viewer identity is header/cookie-only; never URL params.
      </div>
    </div>
  );
}
