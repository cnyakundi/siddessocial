"use client";

import type { SideId } from "@/src/lib/sides";
import type { FeedItem, FeedPage, FeedProvider } from "@/src/lib/feedProvider";
import { RestrictedError, isRestrictedPayload } from "@/src/lib/restricted";

// sd_231: Client code must NEVER call Django cross-origin or forward viewer identity.
// Always call SAME-ORIGIN Next API routes so session cookies are truth.
function buildUrl(
  side: SideId,
  opts?: { topic?: string | null; limit?: number; cursor?: string | null }
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const u = new URL("/api/feed", origin);
  u.searchParams.set("side", side);
  if (opts?.topic) u.searchParams.set("topic", String(opts.topic));
  if (typeof opts?.limit === "number") u.searchParams.set("limit", String(opts.limit));
  if (opts?.cursor) u.searchParams.set("cursor", String(opts.cursor));
  return u.toString();
}

type FeedResp = {
  restricted?: boolean;
  items?: FeedItem[];
  nextCursor?: string | null;
  hasMore?: boolean;
  ok?: boolean;
  error?: string;
};

function clampLimit(n?: number): number {
  const raw = typeof n === "number" ? n : 30;
  if (!Number.isFinite(raw)) return 30;
  return Math.max(1, Math.min(200, Math.floor(raw)));
}

// sd_300: fetch helper used by the DB-backed feed provider.
// - Same-origin only (Next API route)
// - Sends session cookies (credentials: include)
// - No mock fallback (fail closed)
async function fetchWithFallback(
  side: SideId,
  opts?: { topic?: string | null; limit?: number; cursor?: string | null }
): Promise<Response> {
  const url = buildUrl(side, opts);
  try {
    return await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch (e: any) {
    // Network / offline / dev server down.
    const detail = String(e?.message || "network_error");
    return new Response(JSON.stringify({ ok: false, error: "network_error", detail }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

export const backendStubProvider: FeedProvider = {
  name: "backend_stub",

  async listPage(side: SideId, opts?: { topic?: string | null; limit?: number; cursor?: string | null }): Promise<FeedPage> {
    const limit = clampLimit(opts?.limit);
    const cursor = (opts?.cursor || null) as string | null;

    const res = await fetchWithFallback(side, { topic: opts?.topic ?? null, limit, cursor });
    const data = (await res.json().catch(() => null)) as FeedResp | null;

    if (isRestrictedPayload(res, data)) {
      throw new RestrictedError(res.status || 403, "Feed is restricted — sign in as your session user.");
    }

    if (!res.ok || !data) {
      const msg = (data as any)?.error || `Feed request failed (${res.status})`;
      throw new Error(msg);
    }

    const items = Array.isArray(data.items) ? (data.items as FeedItem[]) : [];
    const nextCursor = typeof data.nextCursor === "string" && data.nextCursor ? data.nextCursor : null;
    const hasMore = Boolean(data.hasMore) && !!nextCursor;

    return { items, nextCursor, hasMore };
  },

  async list(side: SideId, opts?: { topic?: string | null }): Promise<FeedItem[]> {
    const page = await backendStubProvider.listPage(side, { topic: opts?.topic ?? null, limit: 50, cursor: null });
    return page.items;
  },
};
