"use client";

import { useEffect } from "react";

// sd_737_app_badge_client
// Clear app-icon badges when the app becomes active.
// Badge-setting is done in the Service Worker on push (when supported).
export function AppBadgeClient() {
  useEffect(() => {
    const nav = navigator as any;
    if (typeof nav?.clearAppBadge !== "function") return;

    const clear = () => {
      try { nav.clearAppBadge(); } catch {}
    };

    // Clear on load + whenever app becomes foreground again.
    clear();

    const onFocus = () => clear();
    const onVis = () => {
      if (document.visibilityState === "visible") clear();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
