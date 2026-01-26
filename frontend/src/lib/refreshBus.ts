"use client";

/**
 * sd_746: Refresh Bus
 * - In standalone PWAs there is no browser refresh chrome.
 * - We offer a safe "soft refresh" signal that screens can subscribe to.
 * - Some pages use router.refresh(); client-only pages (SideFeed) need their own refetch trigger.
 */

export const EVT_APP_REFRESH = "sd:app_refresh";

export function emitAppRefresh(reason: string = "user") {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVT_APP_REFRESH, { detail: { reason } }));
  } catch {
    try {
      window.dispatchEvent(new Event(EVT_APP_REFRESH));
    } catch {
      // ignore
    }
  }
}

export function subscribeAppRefresh(fn: (detail?: any) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: any) => fn((e && (e as any).detail) || undefined);
  window.addEventListener(EVT_APP_REFRESH, handler as any);
  return () => window.removeEventListener(EVT_APP_REFRESH, handler as any);
}

export function hardReload() {
  if (typeof window === "undefined") return;
  try {
    window.location.reload();
  } catch {
    // ignore
  }
}
