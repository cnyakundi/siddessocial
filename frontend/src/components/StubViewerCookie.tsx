"use client";

import { useEffect } from "react";

/**
 * StubViewerCookie
 *
 * Dev convenience until real auth lands.
 *
 * Default behavior (sd_742):
 * - Enabled automatically on localhost/127.0.0.1 (dev + local production builds)
 * - Never runs on real production hosts
 * - Can be disabled explicitly with NEXT_PUBLIC_STUB_VIEWER=0
 *
 * Optional:
 *   NEXT_PUBLIC_STUB_VIEWER_ID=me
 */
export function StubViewerCookie() {
  useEffect(() => {
    const host = (() => {
      try {
        return String(window.location.hostname || "").toLowerCase();
      } catch {
        return "";
      }
    })();

    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    const isProdBuild = process.env.NODE_ENV === "production";

    // Never set stub identity on real production hosts.
    if (isProdBuild && !isLocal) return;

    // Allow explicit opt-out.
    const flag = String(process.env.NEXT_PUBLIC_STUB_VIEWER || "").trim();
    if (flag && flag !== "1" && flag.toLowerCase() !== "true") return;

    const id = (String(process.env.NEXT_PUBLIC_STUB_VIEWER_ID || "me").trim() || "me").slice(0, 64);

    try {
      if (!document.cookie.match(/(?:^|;\s*)sd_viewer=/)) {
        document.cookie = `sd_viewer=${encodeURIComponent(id)}; Path=/; SameSite=Lax`;
      }
    } catch {}
  }, []);

  return null;
}
