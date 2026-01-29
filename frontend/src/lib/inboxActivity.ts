"use client";

/**
 * Inbox Activity (singleton) — deterministic unread badge for Inbox.
 *
 * MVP approach (no websockets yet):
 * - Poll /api/inbox/threads (same-origin Next route) while the app is visible.
 * - Compute unreadThreads = count(items where unread > 0)
 *
 * Why: the DM backend is correct, but UI needs a "live signal" to refresh.
 */
export type InboxActivity = { unreadThreads: number };

type ThreadItem = { unread?: number | null };
type ThreadsResp = { ok?: boolean; restricted?: boolean; items?: ThreadItem[] };

let CACHE: InboxActivity = { unreadThreads: 0 };
let inFlight: Promise<void> | null = null;

type Listener = (a: InboxActivity) => void;
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

export function subscribeInboxActivity(fn: Listener): () => void {
  LISTENERS.add(fn);
  try {
    fn(CACHE);
  } catch {}
  return () => {
    LISTENERS.delete(fn);
  };
}

export function getInboxActivity(): InboxActivity {
  return CACHE;
}

export function setInboxUnreadThreads(unreadThreads: number) {
  const n = Number.isFinite(unreadThreads as any) ? Math.max(0, Math.floor(unreadThreads as any)) : 0;
  CACHE = { unreadThreads: n };
  notify();
}

function computeUnreadThreads(items: ThreadItem[]): number {
  let n = 0;
  for (const it of items) {
    const u0 = Number((it as any)?.unread ?? 0);
    const u = Number.isFinite(u0) ? Math.floor(u0) : 0;
    if (u > 0) n += 1;
  }
  return n;
}

function isVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

// Poll cadence: fast enough to feel instant, slow enough to not spam.
const POLL_MS = 5000;

export async function refreshInboxActivity(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/inbox/threads?limit=50", { cache: "no-store" });
      if (!res.ok) return;

      const j = (await res.json().catch(() => ({}))) as ThreadsResp;
      if (j?.restricted) {
        setInboxUnreadThreads(0);
        return;
      }

      const items = Array.isArray(j?.items) ? j.items : [];
      setInboxUnreadThreads(computeUnreadThreads(items));
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

let ENGINE_STARTED = false;
let ENGINE_TIMER: number | null = null;

export function startInboxActivityEngine(): void {
  if (ENGINE_STARTED) return;
  if (typeof window === "undefined") return;

  ENGINE_STARTED = true;

  const tick = () => {
    if (!isVisible()) return;
    refreshInboxActivity().catch(() => {});
  };

  // First tick
  tick();

  ENGINE_TIMER = window.setInterval(tick, POLL_MS);

  const onWake = () => refreshInboxActivity().catch(() => {});
  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", () => {
    if (isVisible()) onWake();
  });

  void ENGINE_TIMER;
}
