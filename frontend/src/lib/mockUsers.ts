import type { SideId } from "@/src/lib/sides";

export type UserBadge = "Verified" | "Trusted in Work";

export type PinnedStackItem = {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
};

export type MockUser = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  badges?: UserBadge[];
  chips?: string[];
  relationship?: string;

  // Side access rules for this viewer (demo)
  access: Record<SideId, boolean>;

  // Viewer-private set labels (demo only)
  sets?: Array<{
    id: string;
    label: string;
    color: "orange" | "purple" | "rose" | "slate" | "emerald" | "blue";
  }>;

  // Legacy single pinned card
  pinned?: { title: string; subtitle?: string };

  // Public profile "Pinned Stack" (Start Here carousel)
  pinnedStack?: PinnedStackItem[];
};

export const MOCK_USERS: Record<string, MockUser> = {
  me: {
    id: "me",
    name: "Founder",
    handle: "@founder",
    bio: "Building Siddes. Always in beta.",
    badges: ["Verified"],
    access: { public: true, friends: true, close: true, work: true },
    pinnedStack: [
      {
        id: "start",
        title: "Start here",
        subtitle: "What Siddes is",
        body: "Siddes is a Social OS: Context first (Sides), calm by default, and server-enforced privacy.",
      },
      {
        id: "build",
        title: "What I'm building",
        subtitle: "Roadmap + philosophy",
        body: "I'm building the easiest social platform in the world — no context collapse, no AI sludge.",
      },
      {
        id: "rules",
        title: "The rules",
        subtitle: "The constitution",
        body: "You enter a Side. Privacy is enforced server-side. Invites are contextual. Less noise, more signal.",
      },
    ],
  },
  elena: {
    id: "elena",
    name: "Elena Fisher",
    handle: "@elena",
    bio: "Design Systems @ Acme. Coffee snob.",
    chips: ["Designer", "NYC"],
    badges: ["Trusted in Work"],
    relationship: "Followed by Marcus + 3 others",
    pinned: { title: "My design philosophy", subtitle: "Pinned" },
    pinnedStack: [
      {
        id: "who",
        title: "Who I am",
        subtitle: "Design Systems @ Acme",
        body: "I build calm interfaces and ruthless design systems that scale.",
      },
      {
        id: "best",
        title: "My best essays",
        subtitle: "Design + product",
        body: "Notes on building products people actually want to live in.",
      },
      {
        id: "projects",
        title: "Projects",
        subtitle: "Design systems & tooling",
        body: "Tokens, components, documentation, and the boring details that make the magic work.",
      },
    ],
    access: { public: true, friends: true, close: false, work: true },
    sets: [{ id: "weekend", label: "Weekend Crew", color: "purple" }],
  },
  marcus: {
    id: "marcus",
    name: "Marcus",
    handle: "@marc_us",
    bio: "BBQ enthusiast. Weekend warrior.",
    relationship: "Mutual friend",
    access: { public: true, friends: true, close: true, work: false },
    sets: [
      { id: "gym", label: "Gym Squad", color: "orange" },
      { id: "weekend", label: "Weekend Crew", color: "purple" },
    ],
  },
  sarah: {
    id: "sarah",
    name: "Sarah J.",
    handle: "@sara_j",
    bio: "Fitness & Tech.",
    relationship: "Mutual friend",
    access: { public: true, friends: true, close: true, work: false },
    sets: [{ id: "gym", label: "Gym Squad", color: "orange" }],
  },
};

export function getUser(userId: string | null | undefined): MockUser {
  if (!userId) return MOCK_USERS.elena;
  return MOCK_USERS[userId] ?? MOCK_USERS.elena;
}
