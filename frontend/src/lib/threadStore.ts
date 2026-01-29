"use client";

import type { SideId } from "@/src/lib/sides";

export type ThreadMessage = {
  id: string;
  ts: number;
  from: "me" | "them";
  text: string;
  queued?: boolean;
  clientKey?: string | null; // idempotency key for de-dupe (sd_791)
  side?: SideId; // which side this message was sent under (locked side)
};

export type ThreadMeta = {
  lockedSide: SideId;
  updatedAt: number;
};

const KEY_PREFIX = "sd.thread.messages.v0.";
const META_PREFIX = "sd.thread.meta.v0.";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function key(threadId: string) {
  return KEY_PREFIX + threadId;
}

function metaKey(threadId: string) {
  return META_PREFIX + threadId;
}

export function loadThread(threadId: string): ThreadMessage[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(key(threadId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ThreadMessage[];
  } catch {
    return [];
  }
}

export function saveThread(threadId: string, msgs: ThreadMessage[]) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key(threadId), JSON.stringify(msgs));
  } catch {}
}

export function loadThreadMeta(threadId: string): ThreadMeta | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(metaKey(threadId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const lockedSide = (parsed as any).lockedSide as SideId | undefined;
    const updatedAt = (parsed as any).updatedAt as number | undefined;
    if (!lockedSide || typeof updatedAt !== "number") return null;
    return { lockedSide, updatedAt };
  } catch {
    return null;
  }
}

export function saveThreadMeta(threadId: string, meta: ThreadMeta) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(metaKey(threadId), JSON.stringify(meta));
  } catch {}
}

function makeId() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureThreadLockedSide(threadId: string, side: SideId): ThreadMeta {
  const existing = loadThreadMeta(threadId);
  if (existing) return existing;
  const meta: ThreadMeta = { lockedSide: side, updatedAt: Date.now() };
  saveThreadMeta(threadId, meta);
  return meta;
}

export function setThreadLockedSide(threadId: string, side: SideId): ThreadMeta {
  const meta: ThreadMeta = { lockedSide: side, updatedAt: Date.now() };
  saveThreadMeta(threadId, meta);
  return meta;
}

export function appendMessage(threadId: string, msg: Omit<ThreadMessage, "id" | "ts">): ThreadMessage {
  const item: ThreadMessage = { id: makeId(), ts: Date.now(), ...msg };
  const next = [...loadThread(threadId), item];
  saveThread(threadId, next);

  // Bump updatedAt so the inbox list can sort by most recently updated.
  // Preserve the lockedSide from meta if present; otherwise fall back to message side, then friends.
  const existing = loadThreadMeta(threadId);
  const lockedSide: SideId = existing?.lockedSide ?? (msg.side as SideId | undefined) ?? "friends";
  saveThreadMeta(threadId, { lockedSide, updatedAt: item.ts });

  return item;
}
