"use client";

import type {
  InboxProvider,
  InboxProviderListOpts,
  InboxProviderThreadOpts,
  InboxThreadView,
  InboxThreadsPage,
} from "@/src/lib/inboxProvider";
import type { SideId } from "@/src/lib/sides";
import type { ThreadMessage, ThreadMeta } from "@/src/lib/threadStore";
import { getCachedThread, makeThreadCacheKey, setCachedThread } from "@/src/lib/inboxCache";

async function j<T>(res: Response): Promise<T> {
  const data = await res.json();
  return data as T;
}

function localOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost";
}

function buildUrl(path: string, opts?: InboxProviderListOpts | InboxProviderThreadOpts): string {
  const u = new URL(path, localOrigin());

  const side = (opts as any)?.side as string | undefined;
  const limit = (opts as any)?.limit as number | undefined;
  const cursor = (opts as any)?.cursor as string | undefined;

  if (side) u.searchParams.set("side", side);
  if (typeof limit === "number" && Number.isFinite(limit)) u.searchParams.set("limit", String(Math.floor(limit)));
  if (cursor) u.searchParams.set("cursor", cursor);

  return u.toString();
}

async function fetchApi(
  path: string,
  opts: InboxProviderListOpts | InboxProviderThreadOpts | undefined,
  init: RequestInit
): Promise<Response> {
  // IMPORTANT (Siddes law): same-origin only. Never trust client-supplied viewer identity.
  return fetch(buildUrl(path, opts), init);
}

export const backendStubProvider: InboxProvider = {
  name: "backend_stub",

  async listThreads(opts?: InboxProviderListOpts): Promise<InboxThreadsPage> {
    const res = await fetchApi("/api/inbox/threads", opts, { cache: "no-store" });
    const data = await j<any>(res);
    return {
      items: (data?.items || []) as any[],
      hasMore: Boolean(data?.hasMore),
      nextCursor: (data?.nextCursor ?? null) as string | null,
    };
  },

  async getThread(id: string, opts?: InboxProviderThreadOpts): Promise<InboxThreadView> {
    const key = makeThreadCacheKey({
      id,
      limit: (opts as any)?.limit,
      cursor: (opts as any)?.cursor,
    });

    const cached = getCachedThread(key);

    // If we have a fresh cached value, return it immediately and revalidate in background.
    if (cached) {
      // Fire-and-forget revalidate (best effort).
      fetchApi(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, { cache: "no-store" })
        .then((r) => r.json())
        .then((data: any) => {
          if (data?.restricted || !data?.thread) return;
          const fresh: InboxThreadView = {
            thread: data.thread,
            meta: (data.meta ?? null) as ThreadMeta | null,
            messages: (data.messages ?? []) as ThreadMessage[],
            messagesHasMore: Boolean(data?.messagesHasMore),
            messagesNextCursor: (data?.messagesNextCursor ?? null) as string | null,
          };
          setCachedThread(key, fresh);
        })
        .catch(() => {});

      return cached;
    }

    const res = await fetchApi(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, { cache: "no-store" });
    const data = await j<any>(res);

    const view: InboxThreadView = {
      thread: data.thread,
      meta: (data.meta ?? null) as ThreadMeta | null,
      messages: (data.messages ?? []) as ThreadMessage[],
      messagesHasMore: Boolean(data?.messagesHasMore),
      messagesNextCursor: (data?.messagesNextCursor ?? null) as string | null,
    };

    // Don't cache restricted responses.
    if (!data?.restricted && data?.thread) {
      setCachedThread(key, view);
    }

    return view;
  },

  async sendMessage(
    id: string,
    text: string,
    _from: "me" | "them" = "me",
    opts?: InboxProviderThreadOpts
  ): Promise<ThreadMessage> {
    const res = await fetchApi(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await j<any>(res);
    return data.message as ThreadMessage;
  },

  async setLockedSide(id: string, side: SideId, opts?: InboxProviderThreadOpts): Promise<ThreadMeta> {
    const res = await fetchApi(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setLockedSide: side }),
    });
    const data = await j<any>(res);
    return data.meta as ThreadMeta;
  },
};
