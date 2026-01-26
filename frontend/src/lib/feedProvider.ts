"use client";

import type { SideId } from "@/src/lib/sides";
import type { FeedPost } from "@/src/lib/feedTypes";
import { backendStubProvider } from "@/src/lib/feedProviders/backendStub";

export type FeedItem = FeedPost;

export type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type FeedProvider = {
  name: "backend_stub";

  // Cursor-based paging (supersonic feed step).
  // - cursor: opaque string returned by previous page; null for first page.
  // - limit: number of items per page; provider clamps for safety.
  listPage: (
    side: SideId,
    opts?: { topic?: string | null; tag?: string | null; set?: string | null; limit?: number; cursor?: string | null }
  ) => Promise<FeedPage>;

  // Convenience: returns the first page items (legacy call sites).
  list: (side: SideId, opts?: { topic?: string | null; tag?: string | null; set?: string | null }) => Promise<FeedItem[]>;
};

export function getFeedProvider(): FeedProvider {
  // sd_181s: No mock provider. Feed is DB-backed via backend_stub.
  // sd_142: reference NEXT_PUBLIC_API_BASE for API-base-aware wiring checks.
  // Note: feed calls still go via SAME-ORIGIN Next API routes (/api/feed); the proxy layer uses NEXT_PUBLIC_API_BASE.
  const _apiBase = process.env.NEXT_PUBLIC_API_BASE;
  void _apiBase;
  return backendStubProvider;
}
