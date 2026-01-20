import type { SideId } from "@/src/lib/sides";

// sd_181t: Inbox types (no mock data)

export type InboxThread = {
  id: string;
  title: string;
  last: string;
  time: string;
  unread: number;
  lockedSide: SideId;
};
