// DEV-ONLY FEED FIXTURE (empty by default)
//
// This file exists for one reason:
//   scripts/checks/feed_scaffold_check.sh requires frontend/src/lib/mockFeed.ts
//
// IMPORTANT:
//   The real Siddes feed is DB-backed (backend_stub provider) and does NOT import this file.
//   Do NOT wire this into real user paths.
//
// If you ever need deterministic UI fixtures for local dev or Storybook-like work,
// you can populate MOCK_FEED below.

import type { FeedPost } from "@/src/lib/feedTypes";

export const MOCK_FEED: FeedPost[] = [];

export function getMockFeed(): FeedPost[] {
  return MOCK_FEED;
}
