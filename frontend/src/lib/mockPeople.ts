export type MentionCandidate = {
  name: string;
  handle: string;
};

export const MOCK_MENTIONS: MentionCandidate[] = [
  { name: "Marcus", handle: "@marc_us" },
  { name: "Elena Fisher", handle: "@elena" },
  { name: "Sarah J.", handle: "@sara_j" },
  { name: "Project Lead", handle: "@dave_pm" },
];
