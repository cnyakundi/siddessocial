"use client";

import type { SideId } from "@/src/lib/sides";
import type { FeedPost } from "@/src/lib/mockFeed";
import { mockProvider } from "@/src/lib/feedProviders/mock";
import { backendStubProvider } from "@/src/lib/feedProviders/backendStub";

export type FeedItem = FeedPost;

export type FeedProvider = {
  name: "mock" | "backend_stub";
  list: (side: SideId) => Promise<FeedItem[]>;
};

export function getFeedProvider(): FeedProvider {
  const mode = process.env.NEXT_PUBLIC_FEED_PROVIDER as "mock" | "backend_stub" | undefined;
  if (mode === "backend_stub") return backendStubProvider;
  if (mode === "mock") return mockProvider;

  const hasApiBase = Boolean(String(process.env.NEXT_PUBLIC_API_BASE || "").trim());
  return hasApiBase ? backendStubProvider : mockProvider;
}
