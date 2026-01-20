"use client";

import { useEffect } from "react";

/**
 * StubViewerCookie
 *
 * Dev convenience until real auth lands.
 * IMPORTANT: must never run in production builds.
 *
 * Enable explicitly via:
 *   NEXT_PUBLIC_STUB_VIEWER=1
 * Optional:
 *   NEXT_PUBLIC_STUB_VIEWER_ID=me
 */
export function StubViewerCookie() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const enabled = String(process.env.NEXT_PUBLIC_STUB_VIEWER || "").trim() === "1";
    if (!enabled) return;

    const id = (String(process.env.NEXT_PUBLIC_STUB_VIEWER_ID || "me").trim() || "me").slice(0, 64);

    try {
      if (!document.cookie.match(/(?:^|;\s*)sd_viewer=/)) {
        document.cookie = `sd_viewer=${encodeURIComponent(id)}; Path=/; SameSite=Lax`;
      }
    } catch {}
  }, []);

  return null;
}
