"use client";

import { getStoredActiveSide } from "./sideStore";

/**
 * Notifications Activity (singleton) — deterministic unread badge.
 *
 * KEY RULE:
 * - Backend notifications are Side-scoped (public/friends/close/work).
 * - Therefore unread counts MUST be Side-scoped too.
 *
 * This module keeps a per-side cache and a tiny poll engine.
 * It is intentionally boring: no vibes, no fake counters.
 */

export type NotificationsActivity = { unread: number };

type SideId = "public" | "friends" | "close" | "work";
const SIDES: SideId[] = ["public", "friends", "close", "work"];

type NotifItem = { read?: boolean | null };
type NotifsResp = { ok?: boolean; restricted?: boolean; items?: NotifItem[] };

type Listener = (a: NotificationsActivity) => void;

const CACHE: Record<SideId, NotificationsActivity> = {
  public: { unread: 0 },
  friends: { unread: 0 },
  close: { unread: 0 },
  work: { unread: 0 },
};

const LISTENERS: Record<SideId, Set<Listener>> = {
  public: new Set(),
  friends: new Set(),
  close: new Set(),
  work: new Set(),
};

const IN_FLIGHT: Record<SideId, Promise<void> | null> = {
  public: null,
  friends: null,
  close: null,
  work: null,
};

function normalizeSide(x: unknown): SideId {
  const v = String(x || "").trim().toLowerCase();
  if (v === "public" || v === "friends" || v === "close" || v === "work") return v as SideId;
  return "friends";
}

function inferredSide(): SideId {
  try {
    const s = getStoredActiveSide();
    return normalizeSide(s);
  } catch {
    return "friends";
  }
}

function notify(side: SideId) {
  for (const fn of LISTENERS[side]) {
    try {
      fn(CACHE[side]);
    } catch {
      // ignore
    }
  }
}

function computeUnread(items: NotifItem[]): number {
  let unread = 0;
  for (const it of items || []) {
    if (!it) continue;
    if (it.read === true) continue;
    unread += 1;
  }
  return unread;
}

// ---- Backward-compatible API surface ----
// subscribeNotificationsActivity(fn)  OR  subscribeNotificationsActivity(side, fn)
export function subscribeNotificationsActivity(a: any, b?: any): () => void {
  let side: SideId = inferredSide();
  let fn: Listener | null = null;

  if (typeof a === "function") {
    fn = a as Listener;
  } else {
    side = normalizeSide(a);
    fn = (typeof b === "function") ? (b as Listener) : null;
  }

  if (!fn) return () => {};

  LISTENERS[side].add(fn);
  try {
    fn(CACHE[side]);
  } catch {
    // ignore
  }
  return () => LISTENERS[side].delete(fn!);
}

// getNotificationsActivity() OR getNotificationsActivity(side)
export function getNotificationsActivity(side?: any): NotificationsActivity {
  const s = (side === undefined) ? inferredSide() : normalizeSide(side);
  return CACHE[s];
}

// setNotificationsUnread(unread) OR setNotificationsUnread(side, unread)
export function setNotificationsUnread(a: any, b?: any): void {
  let side: SideId = inferredSide();
  let unread: number = 0;

  if (typeof a === "string") {
    side = normalizeSide(a);
    unread = Number(b);
  } else {
    unread = Number(a);
  }

  const n = Number.isFinite(unread) ? Math.max(0, Math.floor(unread)) : 0;
  CACHE[side] = { unread: n };
  notify(side);
}

// refreshNotificationsActivity() OR refreshNotificationsActivity({side, force}) OR refreshNotificationsActivity(side)
export async function refreshNotificationsActivity(opts?: any): Promise<void> {
  const side: SideId = (typeof opts === "string") ? normalizeSide(opts) : normalizeSide(opts?.side ?? inferredSide());
  if (IN_FLIGHT[side]) return IN_FLIGHT[side] as Promise<void>;

  IN_FLIGHT[side] = (async () => {
    try {
      const res = await fetch("/api/notifications", {
        cache: "no-store",
        headers: { "x-sd-side": side },
      });
      if (!res.ok) return;

      const j = (await res.json().catch(() => ({}))) as NotifsResp;
      if (j?.restricted) {
        setNotificationsUnread(side, 0);
        return;
      }

      const items = Array.isArray(j?.items) ? j.items : [];
      setNotificationsUnread(side, computeUnread(items));
    } catch {
      // keep old cache
    }
  })();

  try {
    await IN_FLIGHT[side];
  } finally {
    IN_FLIGHT[side] = null;
  }
}

function isVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

let ENGINE_STARTED = false;
let ENGINE_TIMER: number | null = null;
let ENGINE_SIDE: SideId = inferredSide();

// Poll every 45s; also refresh on focus/visibility restore.
const POLL_MS = 45_000;

// startNotificationsActivityEngine() OR startNotificationsActivityEngine(side)
export function startNotificationsActivityEngine(side?: any): void {
  if (typeof side !== "undefined") {
    ENGINE_SIDE = normalizeSide(side);
  } else {
    ENGINE_SIDE = inferredSide();
  }

  if (ENGINE_STARTED) {
    // Side may have changed — refresh best-effort.
    refreshNotificationsActivity({ force: true, side: ENGINE_SIDE }).catch(() => {});
    return;
  }
  if (typeof window === "undefined") return;

  ENGINE_STARTED = true;

  const tick = () => {
    if (!isVisible()) return;
    refreshNotificationsActivity({ side: ENGINE_SIDE }).catch(() => {});
  };

  // First tick
  tick();

  ENGINE_TIMER = window.setInterval(tick, POLL_MS);

  const onWake = () => refreshNotificationsActivity({ force: true, side: ENGINE_SIDE }).catch(() => {});
  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", () => {
    if (isVisible()) onWake();
  });

  void ENGINE_TIMER;
}

// Convenience: allow callers to pre-warm all sides (optional).
export async function warmAllSides(): Promise<void> {
  for (const s of SIDES) {
    try {
      await refreshNotificationsActivity({ side: s, force: true });
    } catch {
      // ignore
    }
  }
}
