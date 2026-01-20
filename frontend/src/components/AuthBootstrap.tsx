"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { fetchMe } from "@/src/lib/authMe";
import { patchFetchForCsrf } from "@/src/lib/csrf";

/**
 * AuthBootstrap
 *
 * Industry-standard UX:
 * - Auth pages (/login, /signup, /onboarding) show without full app chrome.
 * - Protected pages redirect to /login when not authenticated.
 *
 * Siddes-native:
 * - Authed but not onboarded -> redirect ONCE to onboarding (no loops).
 * - We keep the app calm: no scary blockers; just a gentle redirect.
 *
 * IMPORTANT:
 * - Session auth is truth in production.
 * - No compatibility sd_viewer cookie hacks here.
 */
const ONB_REDIRECT_MARK = "__sd_onb_redirected_v1";

export function AuthBootstrap() {
  // sd_237a: patch fetch so unsafe /api/* requests include X-CSRFToken
  patchFetchForCsrf();
  const pathname = usePathname() || "/";
  useEffect(() => {
    const p = pathname || "/";
    const searchStr = window.location.search.replace(/^\?/, "");
    const isAuthPage = p.startsWith("/login") || p.startsWith("/signup") || p.startsWith("/onboarding");
    if (isAuthPage) return;

    // IMPORTANT: /invite/* must be protected (invite acceptance is session-scoped).
    const protectedPrefixes = [
      "/siddes-feed",
      "/siddes-post",
      "/siddes-sets",
      "/siddes-inbox",
      "/siddes-invites",
      "/siddes-compose",
      "/invite",
      "/siddes-profile",
      "/siddes-settings",
    ];

    const isProtected = protectedPrefixes.some((pre) => p.startsWith(pre));

    fetchMe().then((me) => {
      const authed = !!me?.authenticated;
      const onboarded = !!me?.onboarding?.completed;

      // If authed but not onboarded: redirect once to onboarding.
      if (authed && !onboarded) {
        try {
          const marked = window.sessionStorage.getItem(ONB_REDIRECT_MARK);
          if (!marked) {
            window.sessionStorage.setItem(ONB_REDIRECT_MARK, "1");
            const next = encodeURIComponent(p + (searchStr ? `?${searchStr}` : ""));
            window.location.href = `/onboarding?next=${next}`;
            return;
          }
        } catch {
          // If sessionStorage fails, fall back to always redirecting (safer than leaking)
          const next = encodeURIComponent(p + (searchStr ? `?${searchStr}` : ""));
          window.location.href = `/onboarding?next=${next}`;
          return;
        }
      }

      // Clear redirect mark once onboarded.
      if (authed && onboarded) {
        try {
          window.sessionStorage.removeItem(ONB_REDIRECT_MARK);
        } catch {}
      }

      // If not authenticated and trying to access private surfaces, redirect.
      if (!authed && isProtected) {
        const next = encodeURIComponent(p + (searchStr ? `?${searchStr}` : ""));
        window.location.href = `/login?next=${next}`;
        return;
      }
    });
  }, [pathname]);

  return null;
}
