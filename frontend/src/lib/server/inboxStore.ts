/**
 * In-memory inbox store (dev/stub).
 * Persists only for the lifetime of the Next.js node process.
 *
 * This version also tracks per-thread unread counters per viewer role.
 */

import type { ViewerRole } from "@/src/lib/server/inboxVisibility";
import { allowedSidesForRole } from "@/src/lib/server/inboxVisibility";

export type StoredThread = {
  id: string;
  title: string;
  lockedSide: "public" | "friends" | "close" | "work";
  createdAt: number;
  updatedAt: number;
};

export type StoredMessage = {
  id: string;
  threadId: string;
  ts: number;
  from: "me" | "them";
  text: string;
  side: StoredThread["lockedSide"];
};

export type UnreadByRole = Record<ViewerRole, number>;

type ThreadStore = Map<string, StoredThread>;
type MsgStore = Map<string, StoredMessage[]>;
type UnreadStore = Map<string, UnreadByRole>;

const threads: ThreadStore = (globalThis as any).__SD_INBOX_THREADS_STORE__ || new Map();
const messages: MsgStore = (globalThis as any).__SD_INBOX_MESSAGES_STORE__ || new Map();
const unread: UnreadStore = (globalThis as any).__SD_INBOX_UNREAD_STORE__ || new Map();
const seeded: { done: boolean } = (globalThis as any).__SD_INBOX_SEEDED__ || { done: false };

(globalThis as any).__SD_INBOX_THREADS_STORE__ = threads;
(globalThis as any).__SD_INBOX_MESSAGES_STORE__ = messages;
(globalThis as any).__SD_INBOX_UNREAD_STORE__ = unread;
(globalThis as any).__SD_INBOX_SEEDED__ = seeded;

const ROLES: ViewerRole[] = ["anon", "friends", "close", "work", "me"];

function makeId(prefix = "m"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseRelativeToTs(label: string): number | null {
  const m = String(label || "").trim().match(/^(\d+)([smhdw])$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2].toLowerCase();
  const ms =
    unit === "s"
      ? n * 1_000
      : unit === "m"
      ? n * 60_000
      : unit === "h"
      ? n * 3_600_000
      : unit === "d"
      ? n * 86_400_000
      : unit === "w"
      ? n * 604_800_000
      : 0;
  if (!ms) return null;
  return Date.now() - ms;
}

function emptyUnread(): UnreadByRole {
  return { anon: 0, friends: 0, close: 0, work: 0, me: 0 };
}

function ensureUnread(threadId: string): UnreadByRole {
  const existing = unread.get(threadId);
  if (existing) return existing;
  const u = emptyUnread();
  unread.set(threadId, u);
  return u;
}

export function getThreadUnread(threadId: string, role: ViewerRole): number | null {
  // anon is always 0
  if (role === "anon") return 0;
  const u = unread.get(threadId);
  if (!u) return null;
  return Math.max(0, Math.floor(u[role] ?? 0));
}

export function setThreadUnread(threadId: string, role: ViewerRole, value: number) {
  if (role === "anon") return;
  const u = ensureUnread(threadId);
  u[role] = Math.max(0, Math.floor(value));
  unread.set(threadId, u);
}

export function clearThreadUnreadRole(threadId: string, role: ViewerRole) {
  setThreadUnread(threadId, role, 0);
}

function hashSeed(s: string): number {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x + s.charCodeAt(i)) % 97;
  return x;
}

function initialUnreadHint(args: {
  role: ViewerRole;
  threadId: string;
  lockedSide: string;
  lastFrom: string | null;
}): number {
  if (args.role === "anon") return 0;
  if (!args.lastFrom || args.lastFrom !== "them") return 0;

  const seed = hashSeed(`${args.role}|${args.threadId}|${args.lockedSide}`);
  let n = 1 + (seed % 2); // 1-2

  if (args.role === "me") n += 1;
  if (args.role === "close" && args.lockedSide === "close") n += 1;
  if (args.role === "work" && args.lockedSide === "work") n += 1;
  if (args.role === "friends" && args.lockedSide === "friends") n += 1;

  return Math.min(5, Math.max(0, n));
}

function initUnreadForThread(threadId: string, lockedSide: string, lastFrom: string | null) {
  const u = ensureUnread(threadId);
  for (const role of ROLES) {
    u[role] = initialUnreadHint({ role, threadId, lockedSide, lastFrom });
  }
  // hard rule
  u.anon = 0;
  unread.set(threadId, u);
}

function rolesAllowedForSide(side: StoredThread["lockedSide"]): ViewerRole[] {
  return ROLES.filter((r) => allowedSidesForRole(r).includes(side as any));
}

function bumpUnreadOnAppend(threadId: string, lockedSide: StoredThread["lockedSide"], args: { from: "me" | "them"; viewerRole?: ViewerRole }) {
  const u = ensureUnread(threadId);
  const allowed = rolesAllowedForSide(lockedSide).filter((r) => r !== "anon");

  const callerRole: ViewerRole = args.viewerRole || "me";

  if (args.from === "me") {
    for (const r of allowed) {
      if (r === callerRole) {
        u[r] = 0;
      } else {
        u[r] = Math.min(99, Math.max(0, Math.floor(u[r] ?? 0) + 1));
      }
    }
  } else {
    for (const r of allowed) {
      u[r] = Math.min(99, Math.max(0, Math.floor(u[r] ?? 0) + 1));
    }
  }

  u.anon = 0;
  unread.set(threadId, u);
}

function seedThread(def: {
  id: string;
  title: string;
  lockedSide: StoredThread["lockedSide"];
  time?: string;
  last?: string;
  messages?: Array<{ from: "me" | "them"; text: string; dt?: string }>;
  empty?: boolean;
}) {
  const now = Date.now();
  const approxTs = def.time ? parseRelativeToTs(def.time) ?? now : now;

  const th: StoredThread = {
    id: def.id,
    title: def.title,
    lockedSide: def.lockedSide,
    createdAt: approxTs,
    updatedAt: approxTs,
  };

  threads.set(th.id, th);

  if (def.empty) {
    messages.set(th.id, []);
    initUnreadForThread(th.id, th.lockedSide, null);
    return;
  }

  if (def.messages && def.messages.length) {
    const seededMsgs: StoredMessage[] = def.messages.map((m, idx) => {
      const ts = m.dt ? parseRelativeToTs(m.dt) ?? approxTs + idx * 10_000 : approxTs + idx * 10_000;
      return {
        id: makeId("seed"),
        threadId: th.id,
        ts,
        from: m.from,
        text: m.text,
        side: th.lockedSide,
      };
    });

    messages.set(th.id, seededMsgs);
    th.updatedAt = seededMsgs[seededMsgs.length - 1].ts;
    threads.set(th.id, th);

    const lastFrom = seededMsgs.length ? seededMsgs[seededMsgs.length - 1].from : null;
    initUnreadForThread(th.id, th.lockedSide, lastFrom);

    return;
  }

  const msg: StoredMessage = {
    id: makeId("seed"),
    threadId: th.id,
    ts: approxTs,
    from: "them",
    text: def.last || "Hello!",
    side: th.lockedSide,
  };

  messages.set(th.id, [msg]);
  th.updatedAt = msg.ts;
  threads.set(th.id, th);

  initUnreadForThread(th.id, th.lockedSide, msg.from);
}

function seedOnce() {
  if (seeded.done) return;
  seeded.done = true;

  // Extra seeds (backend_stub only)
  const extra: Array<Parameters<typeof seedThread>[0]> = [
    {
      id: "t_public1",
      title: "Public Noticeboard",
      lockedSide: "public",
      time: "30m",
      messages: [
        { from: "them", text: "Welcome to Siddes — Public lane.", dt: "30m" },
        { from: "me", text: "Quick test message.", dt: "20m" },
      ],
    },
    {
      id: "t_public_empty",
      title: "Public (empty thread)",
      lockedSide: "public",
      time: "3h",
      empty: true,
    },
    {
      id: "t_friends2",
      title: "Nia",
      lockedSide: "friends",
      time: "5m",
      messages: [
        { from: "them", text: "Are you coming?", dt: "8m" },
        { from: "me", text: "Yes — 10 mins.", dt: "5m" },
      ],
    },
    {
      id: "t_close2",
      title: "Inner Circle",
      lockedSide: "close",
      time: "1d",
      messages: [
        { from: "them", text: "Private: don’t forward this.", dt: "2d" },
        { from: "me", text: "Got it.", dt: "1d" },
      ],
    },
    {
      id: "t_work2",
      title: "Ops Set (Work)",
      lockedSide: "work",
      time: "4h",
      messages: [
        { from: "them", text: "Status check: deployments?", dt: "6h" },
        { from: "me", text: "Green. Watching logs.", dt: "4h" },
      ],
    },
    {
      id: "t_long",
      title:
        "Long title edge case — This thread name is intentionally very long to test truncation behavior in the inbox list UI",
      lockedSide: "friends",
      time: "12m",
      last: "Long message edge case: " + "lorem ipsum ".repeat(10).trim(),
    },
  ];

  for (const e of extra) seedThread(e);
}

export function ensureThread(id: string, fallback?: Partial<StoredThread>): StoredThread {
  seedOnce();
  const existing = threads.get(id);
  if (existing) return existing;

  const now = Date.now();
  const th: StoredThread = {
    id,
    title: fallback?.title || "Thread",
    lockedSide: (fallback?.lockedSide as any) || "friends",
    createdAt: fallback?.createdAt ?? now,
    updatedAt: fallback?.updatedAt ?? now,
  };
  threads.set(id, th);
  messages.set(id, []);
  ensureUnread(id); // initialize counters at 0
  return th;
}

export function getThread(id: string): StoredThread | null {
  seedOnce();
  return threads.get(id) || null;
}

export function listThreads(): StoredThread[] {
  seedOnce();
  return Array.from(threads.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listMessages(threadId: string): StoredMessage[] {
  seedOnce();
  return (messages.get(threadId) || []).slice().sort((a, b) => a.ts - b.ts);
}

export function appendMessage(
  threadId: string,
  msg: { from: "me" | "them"; text: string; side?: StoredThread["lockedSide"]; viewerRole?: ViewerRole }
): StoredMessage {
  const th = ensureThread(threadId);
  const item: StoredMessage = {
    id: makeId("m"),
    threadId,
    ts: Date.now(),
    from: msg.from,
    text: msg.text,
    side: msg.side || th.lockedSide,
  };

  const arr = messages.get(threadId) || [];
  arr.push(item);
  messages.set(threadId, arr);

  th.updatedAt = item.ts;
  threads.set(threadId, th);

  bumpUnreadOnAppend(threadId, th.lockedSide, { from: msg.from, viewerRole: msg.viewerRole });

  return item;
}

export function setThreadLockedSide(threadId: string, side: StoredThread["lockedSide"]): StoredThread {
  const th = ensureThread(threadId);
  th.lockedSide = side;
  th.updatedAt = Date.now();
  threads.set(threadId, th);
  // Keep unread counters; visibility filtering will prevent leaks.
  return th;
}
