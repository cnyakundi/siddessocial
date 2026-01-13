/**
 * Siddes — Public Trust Dial (dev MVP)
 *
 * Stores the user’s preferred Public feed “temperature” in localStorage.
 * UI should talk in human terms: Calm / Standard / Arena.
 *
 * This is deliberately client-only and best-effort.
 */

export type PublicTrustMode = "calm" | "standard" | "arena";

const KEY = "sd.publicTrustDial.v0";
export const EVT_PUBLIC_TRUST_DIAL_CHANGED = "sd.publicTrustDial.changed";

export function loadPublicTrustMode(): PublicTrustMode {
  if (typeof window === "undefined") return "standard";
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === "calm" || raw === "standard" || raw === "arena") return raw;
  } catch {
    // ignore
  }
  return "standard";
}

export function savePublicTrustMode(mode: PublicTrustMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, mode);
    window.dispatchEvent(new Event(EVT_PUBLIC_TRUST_DIAL_CHANGED));
  } catch {
    // ignore
  }
}

/**
 * Map the dial to a minimum trust threshold.
 *
 * - Calm: only Trusted (3)
 * - Standard: hide obvious low-trust noise (>= 1)
 * - Arena: show everything (>= 0)
 */
export function minTrustForMode(mode: PublicTrustMode): number {
  switch (mode) {
    case "calm":
      return 3;
    case "standard":
      return 1;
    case "arena":
      return 0;
  }
}
