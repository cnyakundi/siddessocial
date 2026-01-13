import { type SideId } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import type { PublicChannelId } from "@/src/lib/publicChannels";
import type { TrustLevel } from "@/src/lib/trustLevels";

export type PostKind = "text" | "image" | "link";

export type FeedPost = {
  id: string;
  author: string;
  handle: string;
  time: string;
  content: string;
  kind: PostKind;
  tags?: string[];
  publicChannel?: PublicChannelId; // Public Side channel (default "general")

  // Public trust band (under-the-hood; drives the Trust Dial)
  trustLevel?: TrustLevel;

  // v0 context metadata (for chips)
  setId?: string;
  setLabel?: string;
  setColor?: SetColor;
  context?: "mention";
  hasDoc?: boolean;
  urgent?: boolean;

  // v0 signals
  signals?: number;
};

export const MOCK_POSTS: Record<SideId, FeedPost[]> = {
  public: [
    {
      id: "pub-1",
      author: "Elena Fisher",
      handle: "@elena",
      time: "2h",
      content: "Just tried the new coffee spot downtown. The interior design is absolutely stunning.",
      kind: "image",
      tags: ["coffee", "design"],
      publicChannel: "personal",
      trustLevel: 2,
      signals: 42,
    },
    {
      id: "pub-2",
      author: "Tech Insider",
      handle: "@tech_daily",
      time: "4h",
      content: "Siddes v0 is focused on the core loop: Open → React → Post → Return. Everything else is later.",
      kind: "text",
      tags: ["startup", "product"],
      publicChannel: "tech",
      trustLevel: 3,
      signals: 184,
    },
    {
      id: "pub-3",
      author: "New Voice",
      handle: "@new_voice",
      time: "12m",
      content: "Testing the Public side… first post. 👋",
      kind: "text",
      tags: ["hello"],
      publicChannel: "general",
      trustLevel: 0,
      signals: 0,
    },
  ],
  friends: [
    {
      id: "fr-1",
      author: "Marcus",
      handle: "@marc_us",
      time: "15m",
      content: "BBQ at my place this Saturday? I bought way too much brisket.",
      kind: "text",
      tags: ["weekend", "bbq"],
      setId: "weekend",
      setLabel: "Weekend Crew",
      setColor: "purple",
      signals: 23,
    },
    {
      id: "fr-2",
      author: "Sarah J.",
      handle: "@sara_j",
      time: "1h",
      content: "Leg day was brutal. Send help.",
      kind: "image",
      tags: ["gym"],
      setId: "gym",
      setLabel: "Gym Squad",
      setColor: "orange",
      signals: 56,
    },
    {
      id: "fr-3",
      author: "Elena Fisher",
      handle: "@elena",
      time: "3h",
      content: "Does anyone have a plumber recommendation for Brooklyn?",
      kind: "text",
      tags: ["help"],
      signals: 4,
    },
  ],
  close: [
    {
      id: "cl-1",
      author: "Mom",
      handle: "@mom",
      time: "30m",
      content: "Call me when you get a chance, sweetie.",
      kind: "text",
      signals: 1,
    },
    {
      id: "cl-2",
      author: "Bestie",
      handle: "@alix",
      time: "3h",
      content: "Honestly I’m so done with this week. Need a vent session ASAP.",
      kind: "text",
      tags: ["mood"],
      urgent: true,
      signals: 8,
    },
  ],
  work: [
    {
      id: "wk-1",
      author: "Project Lead",
      handle: "@dave_pm",
      time: "10m",
      content: "The Q3 roadmap slides are updated. Please review before the 2pm standup.",
      kind: "link",
      tags: ["roadmap", "urgent"],
      context: "mention",
      hasDoc: true,
      urgent: true,
      signals: 5,
    },
    {
      id: "wk-2",
      author: "Design Team",
      handle: "@design_sys",
      time: "5h",
      content: "New Figma tokens are live. Sync your libraries.",
      kind: "text",
      tags: ["designsystem"],
      hasDoc: true,
      signals: 12,
    },
  ],
};
