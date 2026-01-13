/**
 * In-memory posts store (dev/stub).
 * Persists only for the lifetime of the Next.js node process.
 *
 * Idempotency:
 * - If clientKey is repeated, return the same post (dedupe).
 */

import type { PublicChannelId } from "@/src/lib/publicChannels";
import type { TrustLevel } from "@/src/lib/trustLevels";

export type StoredPost = {
  id: string;
  side: "public" | "friends" | "close" | "work";
  authorId: string;
  author: string;
  handle: string;
  time: string;
  content: string;
  kind: "text" | "image" | "link";
  tags?: string[];
  publicChannel?: PublicChannelId;

  // Under-the-hood trust band (Public Trust Dial)
  trustLevel?: TrustLevel;

  setId?: string;
  urgent?: boolean;
  signals?: number;
  clientKey?: string | null;
  createdAt: number;
};

type Store = Map<string, StoredPost>;
type KeyIndex = Map<string, string>; // clientKey -> postId

const store: Store = (globalThis as any).__SD_POSTS_STORE__ || new Map();
const byClientKey: KeyIndex = (globalThis as any).__SD_POSTS_BY_CLIENTKEY__ || new Map();
(globalThis as any).__SD_POSTS_STORE__ = store;
(globalThis as any).__SD_POSTS_BY_CLIENTKEY__ = byClientKey;

function newId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function upsertPost(input: {
  side: StoredPost["side"];
  text: string;
  setId?: string | null;
  urgent?: boolean;
  publicChannel?: PublicChannelId | null;
  trustLevel?: TrustLevel | null;
  clientKey?: string | null;
}): StoredPost {
  const ck = input.clientKey || null;
  if (ck && byClientKey.has(ck)) {
    const id = byClientKey.get(ck)!;
    const existing = store.get(id);
    if (existing) return existing;
  }

  const post: StoredPost = {
    id: newId(),
    side: input.side,
    authorId: "me",
    author: "Founder",
    handle: "@founder",
    time: "now",
    content: input.text,
    kind: "text",
    publicChannel: input.publicChannel || undefined,
    trustLevel: (input.trustLevel ?? 3) as TrustLevel,
    setId: input.setId || undefined,
    urgent: Boolean(input.urgent) || undefined,
    signals: 0,
    clientKey: ck,
    createdAt: Date.now(),
  };

  store.set(post.id, post);
  if (ck) byClientKey.set(ck, post.id);
  return post;
}

export function getPost(id: string): StoredPost | null {
  return store.get(id) || null;
}

export function listPostsBySide(side: StoredPost["side"]): StoredPost[] {
  return Array.from(store.values())
    .filter((p) => p.side === side)
    .sort((a, b) => b.createdAt - a.createdAt);
}
