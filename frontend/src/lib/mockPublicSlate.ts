import type { TrustLevel } from "@/src/lib/trustLevels";

export type PublicSlateEntryKind = "vouch" | "question";

export type PublicSlateEntry = {
  id: string;
  targetHandle: string;
  fromUserId: string;
  fromName: string;
  fromHandle: string;
  kind: PublicSlateEntryKind;
  text: string;
  createdAtIso: string; // stable (avoid hydration mismatch)
  trustLevel: TrustLevel;
};

export const MOCK_PUBLIC_SLATE: Record<string, PublicSlateEntry[]> = {
  "@elena": [
    {
      id: "elena-1",
      targetHandle: "@elena",
      fromUserId: "marcus",
      fromName: "Marcus",
      fromHandle: "@marc_us",
      kind: "vouch",
      text: "Elena’s design reviews are the reason our app doesn’t feel like a spreadsheet.",
      createdAtIso: "2026-01-09T09:00:00Z",
      trustLevel: 2,
    },
    {
      id: "elena-2",
      targetHandle: "@elena",
      fromUserId: "sarah",
      fromName: "Sarah J.",
      fromHandle: "@sara_j",
      kind: "question",
      text: "Any recs for building a token system that doesn’t turn into a monster?",
      createdAtIso: "2026-01-10T14:12:00Z",
      trustLevel: 1,
    },
    {
      id: "elena-3",
      targetHandle: "@elena",
      fromUserId: "me",
      fromName: "Founder",
      fromHandle: "@founder",
      kind: "vouch",
      text: "If you want calm UI at scale, follow Elena. She’s allergic to clutter (in a good way).",
      createdAtIso: "2026-01-11T06:40:00Z",
      trustLevel: 3,
    },
  ],
  "@founder": [
    {
      id: "founder-1",
      targetHandle: "@founder",
      fromUserId: "elena",
      fromName: "Elena Fisher",
      fromHandle: "@elena",
      kind: "question",
      text: "When do we get per-side bios? Feels inevitable for Work vs Public tone.",
      createdAtIso: "2026-01-10T18:05:00Z",
      trustLevel: 3,
    },
    {
      id: "founder-2",
      targetHandle: "@founder",
      fromUserId: "marcus",
      fromName: "Marcus",
      fromHandle: "@marc_us",
      kind: "vouch",
      text: "The Side concept is so obvious in hindsight. This is the first social app that respects context.",
      createdAtIso: "2026-01-11T07:10:00Z",
      trustLevel: 2,
    },
  ],
};

export function listPublicSlate(targetHandle: string): PublicSlateEntry[] {
  const key = (targetHandle || "").toString();
  return (MOCK_PUBLIC_SLATE[key] ?? []).slice();
}

export function labelForSlateKind(kind: PublicSlateEntryKind): string {
  return kind === "vouch" ? "Vouch" : "Question";
}

export function badgeForSlateTrust(trustLevel: TrustLevel): string {
  if (trustLevel >= 3) return "Trusted";
  if (trustLevel === 2) return "Known";
  if (trustLevel === 1) return "New";
  return "Untrusted";
}
