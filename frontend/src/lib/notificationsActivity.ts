"use client";

/**
 * Notifications Activity (singleton) — deterministic unread badge for the bell.
 *
 * - Source of truth: /api/notifications (DB-backed)
 * - We compute unread = count(items where read === false)
 * - This is NOT a vibe meter. It's a deterministic signal only.
 */

export type NotificationsActivity = { unread: number };

type NotifItem = { read?: boolean | null };

type NotifsResp = {
  ok?: boolean;
  restricted?: boolean;
  items?: NotifItem[];
};

let CACHE: NotificationsActivity = { unread: 0 };
let inFlight: Promise<void> | null = null;

type Listener = (a: NotificationsActivity) => void;
const LISTENERS = new Set<Listener>();

function notify() {
  for (const fn of LISTENERS) {
    try {
      fn(CACHE);
    } catch {
      // ignore
    }
  }
}

export function subscribeNotificationsActivity(fn: Listener): () => void {
  LISTENERS.add(fn);
  try {
    fn(CACHE);
  } catch {
    // ignore
  }
  return () => LISTENERS.delete(fn);
}

export function getNotificationsActivity(): NotificationsActivity {
  return CACHE;
}

export function setNotificationsUnread(unread: number) {
  const n = Number.isFinite(unread) ? Math.max(0, Math.floor(unread)) : 0;
  CACHE = { unread: n };
  notify();
}

function computeUnread(items: NotifItem[]): number {
  let unread = 0;
  for (const it of items) {
    if (!it) continue;
    if (it.read === true) continue;
    unread += 1;
  }
  return unread;
}

export async function refreshNotificationsActivity(opts?: { force?: boolean }): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;

      const j = (await res.json().catch(() => ({}))) as NotifsResp;
      if (j?.restricted) {
        setNotificationsUnread(0);
        return;
      }

      const items = Array.isArray(j?.items) ? j.items : [];
      setNotificationsUnread(computeUnread(items));
    } catch {
      // keep old cache
    }
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

function isVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

let ENGINE_STARTED = false;
let ENGINE_TIMER: number | null = null;

// Poll every 45s; also refresh on focus/visibility restore.
const POLL_MS = 45_000;

export function startNotificationsActivityEngine(): void {
  if (ENGINE_STARTED) return;
  if (typeof window === "undefined") return;

  ENGINE_STARTED = true;

  const tick = () => {
    if (!isVisible()) return;
    refreshNotificationsActivity().catch(() => {});
  };

  // First tick
  tick();

  ENGINE_TIMER = window.setInterval(tick, POLL_MS);

  const onWake = () => refreshNotificationsActivity({ force: true }).catch(() => {});
  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", () => {
    if (isVisible()) onWake();
  });

  void ENGINE_TIMER;
}
