"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * SmartBack:
 * - Prefer returnScroll (sd.return.path) when present (restores list scroll).
 * - Otherwise use history back when it's safe.
 * - Otherwise fall back to a known in-app route.
 */
const RETURN_PATH_KEY = "sd.return.path";

// Only allow safe internal routes.
const SAFE_PREFIXES = [
  "/siddes-feed",
  "/siddes-inbox",
  "/siddes-sets",
  "/siddes-search",
  "/siddes-notifications",
  "/siddes-profile",
  "/siddes-compose",
  "/siddes-post",
  "/u/",
  "/me",
  "/search",
];

function readSafeReturnPath(): string | null {
  try {
    const raw = window.sessionStorage.getItem(RETURN_PATH_KEY);
    if (!raw) return null;
    const p = String(raw);
    if (!p.startsWith("/")) return null;
    if (!SAFE_PREFIXES.some((pre) => p.startsWith(pre))) return null;
    return p;
  } catch {
    return null;
  }
}

function sameOriginReferrer(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const ref = (typeof document !== "undefined" ? document.referrer : "") || "";
    if (!ref) return true; // PWA often has empty referrer
    return new URL(ref).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function useSmartBack(fallbackHref = "/siddes-feed") {
  const router = useRouter();

  return useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        const cur = window.location.pathname + window.location.search;

        // 1) Prefer returnScroll path (best "where I was" experience)
        const p = readSafeReturnPath();
        if (p && p !== cur) {
          router.push(p);
          return;
        }

        // 2) History back (only if likely to stay in-app)
        if (sameOriginReferrer() && window.history.length > 1) {
          router.back();
          return;
        }
      }
    } catch {
      // ignore
    }

    // 3) Final fallback
    try {
      router.push(fallbackHref);
    } catch {
      // ignore
    }
  }, [router, fallbackHref]);
}
