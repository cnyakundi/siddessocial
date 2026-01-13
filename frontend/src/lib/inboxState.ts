"use client";

const PREFIX = "sd.inbox.unread.v0.";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function key(threadId: string) {
  return PREFIX + threadId;
}

export function loadThreadUnread(threadId: string): number | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(key(threadId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  } catch {
    return null;
  }
}

export function saveThreadUnread(threadId: string, n: number) {
  if (!hasWindow()) return;
  try {
    const v = Math.max(0, Math.floor(n));
    window.localStorage.setItem(key(threadId), String(v));
  } catch {}
}

export function clearThreadUnread(threadId: string) {
  saveThreadUnread(threadId, 0);
}

export function loadUnreadMap(threadIds: string[], fallback: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of threadIds) {
    const v = loadThreadUnread(id);
    out[id] = v === null ? (fallback[id] ?? 0) : v;
  }
  return out;
}
