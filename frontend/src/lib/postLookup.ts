import { MOCK_POSTS, type FeedPost } from "@/src/lib/mockFeed";
import type { SideId } from "@/src/lib/sides";

export function findPostById(id: string): { post: FeedPost; side: SideId } | null {
  const sides: SideId[] = ["public", "friends", "close", "work"];
  for (const s of sides) {
    const p = (MOCK_POSTS[s] ?? []).find((x) => x.id === id);
    if (p) return { post: p, side: s };
  }
  return null;
}

export function notifToPostId(notifId: string): string | null {
  if (notifId === "n1") return "fr-1";
  if (notifId === "n2") return "pub-1";
  if (notifId === "n3") return "wk-1";
  return null;
}

export function shouldOpenReply(search: URLSearchParams): boolean {
  return search.get("reply") === "1";
}
