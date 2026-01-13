"use client";

import { type SideId } from "@/src/lib/sides";
import { MOCK_POSTS } from "@/src/lib/mockFeed";
import { getLastSeenId } from "@/src/lib/lastSeen";

export type SideActivity = {
  unread: number;
  mentions?: number;
  docs?: number;
};

export type SideActivityMap = Record<SideId, SideActivity>;

/**
 * Compute unread posts since lastSeen for a Side based on mock feed order.
 * Rule: posts array is newest -> oldest.
 */
export function computeUnreadForSide(side: SideId): number {
  const posts = MOCK_POSTS[side] ?? [];
  if (!posts.length) return 0;

  const lastSeen = getLastSeenId(side);
  if (!lastSeen) return posts.length;

  const idx = posts.findIndex((p) => p.id === lastSeen);
  if (idx === -1) return posts.length;

  // posts before idx are newer
  return idx;
}

/**
 * Work microchips (v0): derived from tags/context in mock feed since lastSeen.
 * - mentions: context === "mention"
 * - docs: hasDoc or kind === "link"
 */
export function computeWorkBreakdown(): { mentions: number; docs: number } {
  const side: SideId = "work";
  const posts = MOCK_POSTS[side] ?? [];
  if (!posts.length) return { mentions: 0, docs: 0 };

  const lastSeen = getLastSeenId(side);
  const idx = lastSeen ? posts.findIndex((p) => p.id === lastSeen) : -1;
  const slice = idx === -1 ? posts : posts.slice(0, idx);

  let mentions = 0;
  let docs = 0;
  for (const p of slice) {
    if ((p as any).context === "mention") mentions += 1;
    if ((p as any).hasDoc || p.kind === "link") docs += 1;
  }
  return { mentions, docs };
}

export function getSideActivityMap(): SideActivityMap {
  const publicUnread = computeUnreadForSide("public");
  const friendsUnread = computeUnreadForSide("friends");
  const closeUnread = computeUnreadForSide("close");
  const workUnread = computeUnreadForSide("work");
  const wb = computeWorkBreakdown();

  return {
    public: { unread: publicUnread },
    friends: { unread: friendsUnread },
    close: { unread: closeUnread },
    work: { unread: workUnread, mentions: wb.mentions, docs: wb.docs },
  };
}

export function formatActivityPill(n: number): string {
  if (n >= 20) return "20+";
  return String(n);
}
