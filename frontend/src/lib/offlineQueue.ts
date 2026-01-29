"use client";

import type { PublicChannelId } from "@/src/lib/publicChannels";
export type QueuedPost = {
  id: string;
  createdAt: number;
  kind: "post";
  side: "public" | "friends" | "close" | "work";
  text: string;
  setId?: string;
  urgent?: boolean;
  publicChannel?: PublicChannelId;
};

export type QueuedReply = {
  id: string;
  createdAt: number;
  kind: "reply";
  postId: string;
  side: "public" | "friends" | "close" | "work";
  text: string;
  parentId?: string;
};

export type QueuedDm = {
  id: string;
  createdAt: number;
  kind: "dm";
  threadId: string;
  side: "public" | "friends" | "close" | "work";
  text: string;
};

export type QueueItem = QueuedPost | QueuedReply | QueuedDm;

const STORAGE_KEY = "sd.offlineQueue.v0";
const USE_API = true; // sd_245: never pretend-send; always attempt real /api writes
const EVT = "sd.offlineQueue.changed";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChanged() {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {
    // ignore
  }
}

export function loadQueue(): QueueItem[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as QueueItem[];
  } catch {
    return [];
  }
}

export function saveQueue(items: QueueItem[]) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
  emitChanged();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueuePost(
  side: QueuedPost["side"],
  text: string,
  meta?: { setId?: string | null; urgent?: boolean; publicChannel?: PublicChannelId | null }
): QueuedPost {
  const item: QueuedPost = {
    id: makeId("qpost"),
    createdAt: Date.now(),
    kind: "post",
    side,
    text,
    setId: meta?.setId ?? undefined,
    urgent: meta?.urgent ?? undefined,
    publicChannel: meta?.publicChannel ?? undefined,
  };
  const next = [item, ...loadQueue()];
  saveQueue(next);
  return item;
}

export function enqueueReply(side: QueuedReply["side"], postId: string, text: string, parentId?: string | null): QueuedReply {
  const item: QueuedReply = {
    id: makeId("qreply"),
    createdAt: Date.now(),
    kind: "reply",
    side,
    postId,
    text,
    parentId: (parentId || "").trim() ? String(parentId).trim() : undefined,
  };
  const next = [item, ...loadQueue()];
  saveQueue(next);
  return item;
}

export function enqueueDm(side: QueuedDm["side"], threadId: string, text: string): QueuedDm {
  const tid = String(threadId || "").trim();
  const t = String(text || "").trim();
  const item: QueuedDm = {
    id: makeId("qdm"),
    createdAt: Date.now(),
    kind: "dm",
    side,
    threadId: tid,
    text: t,
  };
  const next = [item, ...loadQueue()];
  saveQueue(next);
  return item;
}


export function removeQueuedItem(id: string): boolean {
  const items = loadQueue();
  const next = items.filter((x) => x.id !== id);
  if (next.length === items.length) return false;
  saveQueue(next);
  return true;
}

export function clearQueue() {
  saveQueue([]);
}

export function countQueued(kind?: QueueItem["kind"]): number {
  const items = loadQueue();
  if (!kind) return items.length;
  return items.filter((x) => x.kind === kind).length;
}

export function listQueuedRepliesForPost(postId: string): QueuedReply[] {
  return loadQueue()
    .filter((x) => x.kind === "reply" && (x as QueuedReply).postId === postId)
    .map((x) => x as QueuedReply)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function countQueuedRepliesForPost(postId: string): number {
  return listQueuedRepliesForPost(postId).length;
}

async function sendQueuedPost(item: QueuedPost): Promise<boolean> {
  try {
    const res = await fetch("/api/post", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        side: item.side,
        text: item.text,
        setId: item.setId ?? null,
        urgent: Boolean(item.urgent),
        publicChannel: item.publicChannel ?? null,
        client_key: item.id,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendQueuedReply(item: QueuedReply): Promise<boolean> {
  try {
    const res = await fetch(`/api/post/${encodeURIComponent(item.postId)}/reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: item.text,
        parentId: (item.parentId || null),
        client_key: item.id,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendQueuedDm(item: QueuedDm): Promise<boolean> {
  try {
    const threadId = String(item.threadId || "").trim();
    if (!threadId) return false;
    const res = await fetch(`/api/inbox/thread/${encodeURIComponent(threadId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: item.text, clientKey: item.id }),
    });
    const j = (await res.json().catch(() => null)) as any;
    if (!res.ok || !j) return false;
    if (j.ok === false) return false;
    if (j.restricted) return false;
    if (!j.message) return false;
    return true;
  } catch {
    return false;
  }
}

export async function flushQueue(): Promise<{ sent: number; sentPosts: number; sentReplies: number; sentDms: number; remaining: number }> {
  const items = loadQueue();
  if (!items.length) return { sent: 0, sentPosts: 0, sentReplies: 0, sentDms: 0, remaining: 0 };

  let sentPosts = 0;
  let sentReplies = 0;
  let sentDms = 0;

  if (USE_API && typeof fetch !== "undefined") {
    const remaining: QueueItem[] = [];

    for (const it of items) {
      if (it.kind === "post") {
        const ok = await sendQueuedPost(it);
        if (ok) sentPosts += 1;
        else remaining.push(it);
      } else if (it.kind === "reply") {
        const ok = await sendQueuedReply(it);
        if (ok) sentReplies += 1;
        else remaining.push(it);
      } else {
        const ok = await sendQueuedDm(it as any);
        if (ok) sentDms += 1;
        else remaining.push(it);
      }
    }

    saveQueue(remaining);
    return { sent: sentPosts + sentReplies + sentDms, sentPosts, sentReplies, sentDms, remaining: remaining.length };
  }

  sentPosts = items.filter((x) => x.kind === "post").length;
  sentReplies = items.filter((x) => x.kind === "reply").length;
  sentDms = items.filter((x) => (x as any).kind === "dm").length;

  await new Promise((r) => setTimeout(r, 350));
  clearQueue();
  return { sent: items.length, sentPosts, sentReplies, sentDms, remaining: 0 };
}

export function queueChangedEventName() {
  return EVT;
}
