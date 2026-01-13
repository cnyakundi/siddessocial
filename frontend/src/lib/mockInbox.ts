import type { SideId } from "@/src/lib/sides";

export type InboxThread = {
  id: string;
  title: string;
  last: string;
  time: string;
  unread: number;
  lockedSide: SideId;
};

export const MOCK_THREADS: InboxThread[] = [
  { id: "t1", title: "Marcus", last: "Count me in for Saturday!", time: "2m", unread: 1, lockedSide: "friends" },
  { id: "t2", title: "Work Group", last: "Updated the roadmap slides…", time: "10m", unread: 0, lockedSide: "work" },
  { id: "t3", title: "Elena", last: "Coffee later?", time: "1h", unread: 2, lockedSide: "close" },
];
