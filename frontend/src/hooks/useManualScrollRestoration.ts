"use client";

// sd_909_scroll_restoration:
// Force browser scroll restoration to "manual" so Siddes' own scroll restore
// (returnScroll + tab scroll memory) is the single source of truth.

import { useEffect } from "react";

export function useManualScrollRestoration(depKey: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h: any = window.history as any;
    if (!h) return;
    if (typeof h.scrollRestoration !== "string") return;

    let prev = "auto";
    try {
      prev = String(h.scrollRestoration || "auto");
    } catch {}

    try {
      h.scrollRestoration = "manual";
    } catch {}

    return () => {
      try {
        h.scrollRestoration = prev || "auto";
      } catch {}
    };
  }, [depKey]);
}
