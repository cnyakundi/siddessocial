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

function normalizeApiBase(raw: string | undefined | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    // Keep only origin (we always pass absolute paths like /api/inbox/...)
    return u.origin;
  } catch {
    return null;
  }
}

function isRemoteBase(base: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return new URL(base).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function escapeCookieName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const re = new RegExp(`(?:^|; )${escapeCookieName(name)}=([^;]*)`);
  const m = document.cookie.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

function effectiveViewer(opts?: InboxProviderListOpts | InboxProviderThreadOpts): string | undefined {
  const v = (opts as any)?.viewer as string | undefined;
  if (v) return v;

  // In our stub universe, we auto-set `sd_viewer=me` so the app feels alive.
  // When calling Django cross-origin, cookies won't be sent (different origin).
  // We therefore forward the effective viewer via the `x-sd-viewer` header (not a URL query param).
  const c = getCookie("sd_viewer");
  if (c) return c;

  return undefined;
}

function buildUrl(
  path: string,
  opts?: InboxProviderListOpts | InboxProviderThreadOpts,
  baseOverride?: string
): string {
  const base = baseOverride || localOrigin();
  const u = new URL(path, base);

  const side = (opts as any)?.side as string | undefined;
  const limit = (opts as any)?.limit as number | undefined;
  const cursor = (opts as any)?.cursor as string | undefined;

  if (side) u.searchParams.set("side", side);
  if (typeof limit === "number" && Number.isFinite(limit)) u.searchParams.set("limit", String(Math.floor(limit)));
  if (cursor) u.searchParams.set("cursor", cursor);

  return u.toString();
}

function withViewerHeader(init: RequestInit, viewer: string): RequestInit {
  const headers = new Headers(init.headers || {});
  headers.set("x-sd-viewer", viewer);
  return { ...init, headers };
}

function usesDjangoBase(): { enabled: boolean; base: string | null } {
  const base = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE);
  if (!base) return { enabled: false, base: null };
  // Only treat it as "django mode" when it points off-origin (docker dev).
  return { enabled: isRemoteBase(base), base };
}

async function fetchWithFallback(
  path: string,
  opts: InboxProviderListOpts | InboxProviderThreadOpts | undefined,
  init: RequestInit
): Promise<Response> {
  const django = usesDjangoBase();
  const viewer = effectiveViewer(opts);
  const initWithViewer = viewer ? withViewerHeader(init, viewer) : init;

  // Primary: Django base (cross-origin) when configured.
  if (django.enabled && django.base) {
    try {
      const res = await fetch(buildUrl(path, opts, django.base), initWithViewer);
      // If the server responded, keep it unless it's a hard server error.
      if (res.status < 500) return res;
    } catch {
      // network/CORS failure -> fallback below
    }
  }

  // Fallback: Next.js API stubs (same-origin)
  return fetch(buildUrl(path, opts, localOrigin()), initWithViewer);
}

export const backendStubProvider: InboxProvider = {
  name: "backend_stub",

  async listThreads(opts?: InboxProviderListOpts): Promise<InboxThreadsPage> {
    const res = await fetchWithFallback("/api/inbox/threads", opts, { cache: "no-store" });
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
      viewer: (opts as any)?.viewer,
      limit: (opts as any)?.limit,
      cursor: (opts as any)?.cursor,
    });

    const cached = getCachedThread(key);

    // If we have a fresh cached value, return it immediately and revalidate in background.
    if (cached) {
      // Fire-and-forget revalidate (best effort).
      fetchWithFallback(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, { cache: "no-store" })
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

    const res = await fetchWithFallback(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, { cache: "no-store" });
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
    from: "me" | "them" = "me",
    opts?: InboxProviderThreadOpts
  ): Promise<ThreadMessage> {
    const django = usesDjangoBase();

    const body = django.enabled
      ? { text } // Django contract
      : { text, from }; // Next API stub contract

    const res = await fetchWithFallback(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await j<any>(res);
    return data.message as ThreadMessage;
  },

  async setLockedSide(id: string, side: SideId, opts?: InboxProviderThreadOpts): Promise<ThreadMeta> {
    const res = await fetchWithFallback(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setLockedSide: side }),
    });
    const data = await j<any>(res);
    return data.meta as ThreadMeta;
  },
};
