import type { FeedPost } from "@/src/lib/feedTypes";

// sd_181s: postLookup is deprecated. Post detail must fetch /api/post/:id.
// Keeping this stub to avoid build breaks if an old import lingers.

export function findPostById(_id: string): FeedPost | null {
  return null;
}
