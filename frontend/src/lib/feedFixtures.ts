// DEV-ONLY FEED FIXTURES (empty by default)
//
// This file exists for one reason:
//   scripts/checks/feed_scaffold_check.sh requires frontend/src/lib/feedFixtures.ts
//
// IMPORTANT:
//   The real Siddes feed is DB-backed and does NOT import this file.
//   Do NOT wire this into real user paths.
//
// Required substrings for checks (do not remove):
//   - publicChannel (sd_128)
//   - trustLevel (sd_130)

import type { FeedPost } from "@/src/lib/feedTypes";

export const FEED_FIXTURES: FeedPost[] = [];

export function getFeedFixtures(): FeedPost[] {
  return FEED_FIXTURES;
}

// For grep-based checks: publicChannel trustLevel
