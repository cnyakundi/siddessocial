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
import { RestrictedError, isRestrictedPayload } from "@/src/lib/restricted";

// sd_142 parity: resolve an origin even when window is unavailable (SSR/tests).
// Browser still uses SAME-ORIGIN Next API routes.
function resolveOrigin(): string {
  if (typeof window !== "undefined" && window.location && window.location.origin) return window.location.origin;

  const raw = process.env.NEXT_PUBLIC_API_BASE;
  const s = String(raw || "").trim();
  if (s) {
    try {
      return new URL(s).origin;
    } catch {
      try {
        return new URL("http://" + s).origin;
      } catch {
        // ignore
      }
    }
  }

  return "http://localhost";
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie ? document.cookie.split(";") : [];
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("=") || "");
  }
  return null;
}

function buildUrl(path: string, opts?: InboxProviderListOpts | InboxProviderThreadOpts): string {
  const origin = resolveOrigin();
  const u = new URL(path, origin);

  const side = (opts as any)?.side as string | undefined;
  const limit = (opts as any)?.limit as number | undefined;
  const cursor = (opts as any)?.cursor as string | undefined;

  if (side) u.searchParams.set("side", side);
  if (typeof limit === "number" && Number.isFinite(limit)) u.searchParams.set("limit", String(Math.floor(limit)));
  if (cursor) u.searchParams.set("cursor", cursor);

  return u.toString();
}

// sd_300 parity: safe fetch helper for the DB-backed inbox provider.
// - Browser: same-origin Next API routes (/api/inbox/*) so session cookies are truth.
// - SSR/tests: falls back to NEXT_PUBLIC_API_BASE origin resolution.
// - Dev-only: forwards x-sd-viewer from opts.viewer or sd_viewer cookie.
async function fetchWithFallback(
  path: string,
  opts: InboxProviderListOpts | InboxProviderThreadOpts | undefined,
  init: RequestInit
): Promise<Response> {
  const url = buildUrl(path, opts);
  try {
    const headers = new Headers(init.headers || {});
    if (!headers.has("accept")) headers.set("accept", "application/json");

    if (process.env.NODE_ENV !== "production") {
      const fromOpts = String((opts as any)?.viewer || "").trim();
      const fromCookie = String(getCookie("sd_viewer") || "").trim();
      const v = fromOpts || fromCookie;
      if (v) headers.set("x-sd-viewer", v);
    }

    return await fetch(url, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch (e: any) {
    const detail = String(e?.message || "network_error");
    return new Response(JSON.stringify({ ok: false, error: "network_error", detail }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

type ThreadsResp = {
  ok?: boolean;
  error?: string;
  restricted?: boolean;
  items?: any[];
  hasMore?: boolean;
  nextCursor?: string | null;
};

type ThreadResp = {
  ok?: boolean;
  error?: string;
  restricted?: boolean;
  thread?: any;
  meta?: ThreadMeta | null;
  messages?: ThreadMessage[];
  messagesHasMore?: boolean;
  messagesNextCursor?: string | null;
  message?: ThreadMessage;
};

export const backendStubProvider: InboxProvider = {
  name: "backend_stub",

  async listThreads(opts?: InboxProviderListOpts): Promise<InboxThreadsPage> {
    const res = await fetchWithFallback("/api/inbox/threads", opts, { method: "GET" });
    const data = (await res.json().catch(() => null)) as ThreadsResp | null;

    if (isRestrictedPayload(res, data)) {
      throw new RestrictedError(res.status || 403, "Inbox is restricted — sign in as your session user.");
    }

    if (!res.ok || !data) {
      const msg = (data as any)?.error || `Inbox request failed (${res.status})`;
      throw new Error(msg);
    }

    return {
      items: (Array.isArray(data.items) ? data.items : []) as any[],
      hasMore: Boolean(data.hasMore),
      nextCursor: (typeof data.nextCursor === "string" ? data.nextCursor : null) as string | null,
      restricted: Boolean(data?.restricted),
    };
  },

  async getThread(id: string, opts?: InboxProviderThreadOpts): Promise<InboxThreadView> {
    const key = makeThreadCacheKey({
      id,
      limit: (opts as any)?.limit,
      cursor: (opts as any)?.cursor,
    });

    const cached = getCachedThread(key);

    // If we have a cached value, return it immediately and revalidate in background.
    if (cached) {
      fetchWithFallback(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, { method: "GET" })
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

    const res = await fetchWithFallback(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, { method: "GET" });
    const data = (await res.json().catch(() => null)) as ThreadResp | null;

    if (isRestrictedPayload(res, data)) {
      throw new RestrictedError(res.status || 403, "Thread is restricted — sign in as your session user.");
    }

    if (!res.ok || !data) {
      const msg = (data as any)?.error || `Thread request failed (${res.status})`;
      throw new Error(msg);
    }

    const view: InboxThreadView = {
      thread: (data.thread as any) ?? ({} as any),
      meta: (data.meta ?? null) as ThreadMeta | null,
      messages: (data.messages ?? []) as ThreadMessage[],
      messagesHasMore: Boolean(data?.messagesHasMore),
      messagesNextCursor: (data?.messagesNextCursor ?? null) as string | null,
    };

    // Don't cache restricted / empty.
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
    const res = await fetchWithFallback(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = (await res.json().catch(() => null)) as ThreadResp | null;

    if (isRestrictedPayload(res, data)) {
      throw new RestrictedError(res.status || 403, "Thread is restricted — sign in as your session user.");
    }

    if (!res.ok || !data || !data.message) {
      const msg = (data as any)?.error || `Send failed (${res.status})`;
      throw new Error(msg);
    }

    return data.message as ThreadMessage;
  },

  async setLockedSide(id: string, side: SideId, opts?: InboxProviderThreadOpts): Promise<ThreadMeta> {
    const res = await fetchWithFallback(`/api/inbox/thread/${encodeURIComponent(id)}`, opts, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setLockedSide: side }),
    });

    const data = (await res.json().catch(() => null)) as ThreadResp | null;

    if (isRestrictedPayload(res, data)) {
      throw new RestrictedError(res.status || 403, "Thread is restricted — sign in as your session user.");
    }

    if (!res.ok || !data || !data.meta) {
      const msg = (data as any)?.error || `Move failed (${res.status})`;
      throw new Error(msg);
    }

    return data.meta as ThreadMeta;
  },
};
