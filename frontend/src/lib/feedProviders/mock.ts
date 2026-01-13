"use client";

import type { SideId } from "@/src/lib/sides";
import { MOCK_POSTS } from "@/src/lib/mockFeed";
import type { FeedItem, FeedProvider } from "@/src/lib/feedProvider";

export const mockProvider: FeedProvider = {
  name: "mock",
  async list(side: SideId): Promise<FeedItem[]> {
    return MOCK_POSTS[side] ?? [];
  },
};
