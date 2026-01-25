"use client";

import type { MeResponse } from "@/src/lib/authMe";

export const EVT_SESSION_IDENTITY_CHANGED = "sd:sessionIdentityChanged";

const KEY_VIEWER = "sd.session.viewerId.v1";
const KEY_EPOCH = "sd.session.epoch.v1";
const KEY_AUTHED = "sd.session.authed.v1";
const KEY_CONFIRMED_AT = "sd.session.confirmedAt.v1";

export type SessionIdentity = {
  viewerId: string | null;
  epoch: string | null;
  authed: boolean;
  confirmedAt: number | null;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function now() {
  return Date.now();
}

function randId(): string {
  try {
    const uuid = (globalThis as any)?.crypto?.randomUUID?.();
    if (uuid) return String(uuid).replace(/-/g, "").slice(0, 16);
  } catch {
    // ignore
  }
  return (
    (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2))
      .replace(/[^a-f0-9]/g, "")
      .slice(0, 16) || "0000000000000000"
  );
}

function readStr(k: string): string | null {
  if (!hasWindow()) return null;
  try {
    const v = window.sessionStorage.getItem(k);
    const s = String(v || "").trim();
    return s ? s : null;
  } catch {
    return null;
  }
}

function readNum(k: string): number | null {
  const s = readStr(k);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function getSessionIdentity(): SessionIdentity {
  const viewerId = readStr(KEY_VIEWER);
  const epoch = readStr(KEY_EPOCH);
  const authed = readStr(KEY_AUTHED) === "1";
  const confirmedAt = readNum(KEY_CONFIRMED_AT);
  return { viewerId, epoch, authed, confirmedAt };
}

function emitChanged() {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new CustomEvent(EVT_SESSION_IDENTITY_CHANGED));
  } catch {
    // ignore
  }
}

export function clearSessionIdentity() {
  if (!hasWindow()) return;
  try {
    window.sessionStorage.removeItem(KEY_VIEWER);
    window.sessionStorage.removeItem(KEY_EPOCH);
    window.sessionStorage.removeItem(KEY_AUTHED);
    window.sessionStorage.removeItem(KEY_CONFIRMED_AT);
  } catch {
    // ignore
  }
  emitChanged();
}

/**
 * Update the current in-tab "session identity" from /api/auth/me.
 *
 * Why:
 * - Client caches must be scoped per-user AND per-auth-epoch.
 * - If the user changes (or becomes unauthenticated), we must rotate/clear.
 */
export function updateSessionFromMe(me: MeResponse | null | undefined) {
  if (!hasWindow()) return;

  const authed = !!me?.authenticated;
  const viewer = authed && me?.viewerId ? String(me.viewerId).trim() : "";

  if (!authed || !viewer) {
    clearSessionIdentity();
    return;
  }

  const cur = getSessionIdentity();
  const viewerChanged = !!cur.viewerId && cur.viewerId !== viewer;
  const needEpoch = !cur.epoch || viewerChanged;
  const epoch = needEpoch ? randId() : String(cur.epoch);

  try {
    window.sessionStorage.setItem(KEY_VIEWER, viewer);
    window.sessionStorage.setItem(KEY_EPOCH, epoch);
    window.sessionStorage.setItem(KEY_AUTHED, "1");
    window.sessionStorage.setItem(KEY_CONFIRMED_AT, String(now()));
  } catch {
    // ignore
  }
  emitChanged();
}

/**
 * Mark the current identity as recently confirmed.
 * Call this after successful authenticated API calls.
 */
export function touchSessionConfirmed() {
  if (!hasWindow()) return;
  const cur = getSessionIdentity();
  if (!cur.epoch || !cur.viewerId) return;
  try {
    window.sessionStorage.setItem(KEY_CONFIRMED_AT, String(now()));
    window.sessionStorage.setItem(KEY_AUTHED, "1");
  } catch {
    // ignore
  }
  emitChanged();
}
