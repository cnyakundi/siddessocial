"use client";

import type { FeedItem, FeedPage } from "@/src/lib/feedProvider";

type WarmEntry = {
  key: string;
  ts: number;
  page: FeedPage;
};

const DB_NAME = "siddes_warm_cache_v1";
const STORE = "feed_pages";
const DB_VERSION = 1;

// Warm cache: longer-lived than sessionStorage, but NOT a full offline archive.
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_KEYS = 30;
const MAX_ITEMS = 80;

function hasWindow() {
  return typeof window !== "undefined";
}

function now() {
  return Date.now();
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("idb_request_failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("idb_tx_failed"));
    tx.onabort = () => reject(tx.error || new Error("idb_tx_aborted"));
  });
}

async function openDb(): Promise<IDBDatabase> {
  if (!hasWindow()) throw new Error("no_window");
  const idb = (window as any).indexedDB as IDBFactory | undefined;
  if (!idb) throw new Error("no_indexeddb");

  return await new Promise((resolve, reject) => {
    const r = idb.open(DB_NAME, DB_VERSION);

    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: "key" });
        st.createIndex("ts", "ts", { unique: false });
      }
    };

    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("idb_open_failed"));
  });
}

function sanitizeItem(item: FeedItem): FeedItem {
  const p: any = item as any;
  if (!p || typeof p !== "object") return item;

  const out: any = { ...p };

  // Clamp media list.
  if (Array.isArray(out.media)) {
    out.media = out.media.slice(0, 6).map((m: any) => (m && typeof m === "object" ? { ...m } : m));
  }

  // Clamp tags.
  if (Array.isArray(out.tags)) out.tags = out.tags.slice(0, 8);

  // Clamp big strings.
  if (typeof out.content === "string" && out.content.length > 12000) out.content = out.content.slice(0, 12000);

  if (out.echoOf && typeof out.echoOf === "object") {
    const eo: any = { ...out.echoOf };
    if (typeof eo.content === "string" && eo.content.length > 6000) eo.content = eo.content.slice(0, 6000);
    out.echoOf = eo;
  }

  return out as FeedItem;
}

function sanitizePage(page: FeedPage): FeedPage {
  const items = Array.isArray(page?.items) ? (page.items as FeedItem[]) : [];
  return {
    items: items.slice(0, MAX_ITEMS).map(sanitizeItem),
    nextCursor: page?.nextCursor ?? null,
    hasMore: Boolean(page?.hasMore),
  };
}

function isFresh(ts: number): boolean {
  if (!Number.isFinite(ts)) return false;
  return now() - ts <= TTL_MS;
}

async function pruneIfNeeded(db: IDBDatabase) {
  try {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);

    const count = await req(st.count());
    if (!Number.isFinite(count) || count <= MAX_KEYS) {
      await txDone(tx);
      return;
    }

    const toDrop = Math.max(0, count - MAX_KEYS);
    if (toDrop <= 0) {
      await txDone(tx);
      return;
    }

    let dropped = 0;
    const idx = st.index("ts");
    await new Promise<void>((resolve) => {
      const curReq = idx.openCursor();
      curReq.onsuccess = () => {
        const cur = curReq.result;
        if (!cur) return resolve();
        if (dropped >= toDrop) return resolve();
        try {
          st.delete((cur.value as any)?.key);
        } catch {}
        dropped++;
        cur.continue();
      };
      curReq.onerror = () => resolve(); // fail-open
    });

    await txDone(tx);
  } catch {
    // ignore
  }
}

export function makePublicFeedWarmKey(args: { topic?: string | null; tag?: string | null; cursor?: string | null; limit?: number }) {
  const topic = String(args.topic || "").trim() || "_";
  const tag = String(args.tag || "").trim() || "_";
  const cursor = String(args.cursor || "").trim() || "first";
  const limit = typeof args.limit === "number" ? String(args.limit) : "_";
  return `pubfeed:v1|topic:${topic}|tag:${tag}|cursor:${cursor}|limit:${limit}`;
}

export async function getWarmFeedPage(key: string): Promise<FeedPage | null> {
  if (!key) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const st = tx.objectStore(STORE);
    const entry = (await req(st.get(key))) as WarmEntry | undefined;
    await txDone(tx);
    try { db.close(); } catch {}
    if (!entry || !entry.page) return null;
    if (!isFresh(Number(entry.ts))) return null;
    return entry.page;
  } catch {
    return null;
  }
}

export async function setWarmFeedPage(key: string, page: FeedPage): Promise<void> {
  if (!key) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);

    const safe = sanitizePage(page);
    const entry: WarmEntry = { key, ts: now(), page: safe };
    st.put(entry);

    await txDone(tx);
    await pruneIfNeeded(db);
    try { db.close(); } catch {}
  } catch {
    // ignore
  }
}

/**
 * Clear warm feed cache (used on logout/session invalidation).
 * We delete the whole DB for simplicity + speed.
 */
export function clearFeedWarmCache() {
  if (!hasWindow()) return;
  try {
    const idb = (window as any).indexedDB as IDBFactory | undefined;
    if (!idb) return;
    idb.deleteDatabase(DB_NAME);
  } catch {
    // ignore
  }
}
