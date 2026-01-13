/**
 * In-memory replies store (dev/stub).
 * Persists only for the lifetime of the Next.js node process.
 *
 * In production, replies live in your backend DB.
 */

export type StoredReply = {
  id: string;
  postId: string;
  text: string;
  createdAt: number;
  clientKey?: string | null;
};

type Store = Map<string, StoredReply[]>;

const store: Store = (globalThis as any).__SD_REPLIES_STORE__ || new Map();
(globalThis as any).__SD_REPLIES_STORE__ = store;

export function addReply(r: StoredReply) {
  const list = store.get(r.postId) || [];
  list.push(r);
  store.set(r.postId, list);
}

export function listReplies(postId: string): StoredReply[] {
  return (store.get(postId) || []).slice().sort((a, b) => a.createdAt - b.createdAt);
}
