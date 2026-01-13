"use client";

const KEY = "sd.inbox.pins.v0";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadPinnedSet(): Set<string> {
  if (!hasWindow()) return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function savePinnedSet(s: Set<string>) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(s)));
  } catch {}
}

export function togglePinned(threadId: string): boolean {
  const s = loadPinnedSet();
  if (s.has(threadId)) {
    s.delete(threadId);
    savePinnedSet(s);
    return false;
  }
  s.add(threadId);
  savePinnedSet(s);
  return true;
}

export function isPinned(threadId: string): boolean {
  return loadPinnedSet().has(threadId);
}

export function clearPinned() {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
