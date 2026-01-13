"use client";

/**
 * stubViewerClient
 *
 * Small helper for client-side pages that need to behave nicely in our
 * default-safe stub universe.
 *
 * Convention:
 * - In stub mode, only sd_viewer="me" (or "me_*" variants) is allowed to mutate.
 * - Other viewers can read membership-scoped data but should see read-only UI.
 */

function escapeCookieName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, "\\$&");
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${escapeCookieName(name)}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export function getStubViewerCookie(): string | undefined {
  return getCookie("sd_viewer");
}

export function isStubMe(viewer: string | undefined | null): boolean {
  const v = String(viewer || "").trim().toLowerCase();
  if (!v) return false;
  return v === "me" || v.startsWith("me_");
}
