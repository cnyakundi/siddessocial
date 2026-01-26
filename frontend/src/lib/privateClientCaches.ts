"use client";

import { clearInboxCache } from "@/src/lib/inboxCache";
import { clearFeedInstantCache } from "@/src/lib/feedInstantCache";
import { clearQueue } from "@/src/lib/offlineQueue";
import { clearSessionIdentity } from "@/src/lib/sessionIdentity";

// sd_586: Auth/session invalidation hard reset.
// Reason: A tab can keep showing cached private state (feed/thread/drafts) after a session expires
// or a different user signs in within the same browser profile.

const KEY_INVALIDATED_AT = "sd.session.invalidatedAt.v1";
const INVALIDATION_COOLDOWN_MS = 8_000;

const AUTH_SHELL_PREFIXES = [
  "/login",
  "/signup",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/confirm-email-change",
  "/confirm-delete",
  "/account-deletion",
];

const PROTECTED_PREFIXES = [
  "/siddes-feed",
  "/siddes-post",
  "/siddes-sets",
  "/siddes-inbox",
  "/siddes-invites",
  "/siddes-compose",
  "/invite",
  "/siddes-profile",
];

function hasWindow() {
  return typeof window !== "undefined";
}

function isAuthShellPath(p: string): boolean {
  return AUTH_SHELL_PREFIXES.some((pre) => p.startsWith(pre));
}

function isProtectedPath(p: string): boolean {
  return PROTECTED_PREFIXES.some((pre) => p.startsWith(pre));
}

function throttleInvalidation(): boolean {
  if (!hasWindow()) return false;
  try {
    const now = Date.now();
    const lastRaw = window.sessionStorage.getItem(KEY_INVALIDATED_AT) || "0";
    const last = Number(lastRaw);
    if (Number.isFinite(last) && now - last < INVALIDATION_COOLDOWN_MS) return true;
    window.sessionStorage.setItem(KEY_INVALIDATED_AT, String(now));
  } catch {
    // ignore
  }
  return false;
}

/**
 * Clear private client caches BUT preserve session identity.
 * Use this when the user changes without a full logout flow.
 */
export function clearPrivateDataCaches() {
  try {
    clearFeedInstantCache();
  } catch {}

  try {
    clearInboxCache();
  } catch {}

  try {
    clearQueue();
  } catch {}
}

/**
 * Clear client-side private caches that must not survive logout / user changes.
 *
 * Keep it small + explicit (no magic).
 */
export function clearPrivateClientCaches() {
  clearPrivateDataCaches();

  try {
    clearSessionIdentity();
  } catch {}
}

/**
 * Handle session invalidation in a fail-closed way:
 * - clear private client caches immediately
 * - optionally redirect to login if currently on a protected surface
 */
export function handleSessionInvalidation(reason: string = "session_invalid", opts?: { redirectToLogin?: boolean }) {
  if (!hasWindow()) return;

  // Prevent redirect loops when multiple requests fail at once.
  const throttled = throttleInvalidation();

  try {
    clearPrivateClientCaches();
  } catch {}

  const redirect = opts?.redirectToLogin !== false;
  if (!redirect || throttled) return;

  try {
    const p = window.location?.pathname || "/";
    if (isAuthShellPath(p)) return;
    if (!isProtectedPath(p)) return;

    const next = encodeURIComponent(p + (window.location?.search || ""));
    const e = encodeURIComponent(reason || "session_invalid");
    const href = `/login?next=${next}&e=${e}`;
    try {
      window.dispatchEvent(new CustomEvent("sd:navigate", { detail: { href, replace: true } }));
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}
