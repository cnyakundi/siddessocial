"use client";

/**
 * authUiFlags
 *
 * MVP rule:
 * - Hide advanced auth UI (OAuth, password reset, magic links) until real production host.
 * - Allow explicit override for testing: NEXT_PUBLIC_AUTH_ADVANCED=1
 */

function host(): string {
  try {
    return String(window.location.hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

export function isLocalHost(): boolean {
  const h = host();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

export function shouldShowAdvancedAuthUi(): boolean {
  // Explicit override (dev/staging) — default is OFF.
  const flag = String(process.env.NEXT_PUBLIC_AUTH_ADVANCED || "").trim().toLowerCase();
  if (flag && flag !== "0" && flag !== "false") return true;

  // Default: only on real production hosts.
  if (process.env.NODE_ENV !== "production") return false;
  if (isLocalHost()) return false;
  return true;
}
