export type NotifType = "reply" | "like" | "mention";

export type NotificationItem = {
  id: string;
  actor: string;
  type: NotifType;
  time: string; // display string (legacy)
  ts: number;   // epoch ms
  glimpse: string;
};

const now = Date.now();

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", actor: "Marcus", type: "reply", time: "2m", ts: now - 2 * 60 * 1000, glimpse: "Count me in for Saturday!" },
  { id: "n2", actor: "Elena", type: "like", time: "1h", ts: now - 60 * 60 * 1000, glimpse: "Liked your post about coffee." },
  { id: "n3", actor: "Work Group", type: "mention", time: "3h", ts: now - 3 * 60 * 60 * 1000, glimpse: "@dave_pm mentioned you in Q3 Roadmap" },
  // Earlier
  { id: "n4", actor: "Elena", type: "like", time: "1d", ts: now - 26 * 60 * 60 * 1000, glimpse: "Liked your design post." },
  { id: "n5", actor: "Marcus", type: "like", time: "2d", ts: now - 52 * 60 * 60 * 1000, glimpse: "Liked your BBQ post." },
];
