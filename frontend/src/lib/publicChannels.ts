export type PublicChannelId = "general" | "tech" | "politics" | "personal";

export type PublicChannel = {
  id: PublicChannelId;
  label: string;
  desc: string;
};

export const PUBLIC_CHANNELS: PublicChannel[] = [
  { id: "general", label: "General", desc: "Default stream" },
  { id: "tech", label: "Tech", desc: "Projects, tools, engineering" },
  { id: "politics", label: "Politics", desc: "Civics, governance, debate" },
  { id: "personal", label: "Personal", desc: "Life, stories, casual" },
];

export function normalizePublicChannel(raw: unknown): PublicChannelId {
  const s = (raw ?? "").toString().toLowerCase();
  const ids = new Set(PUBLIC_CHANNELS.map((c) => c.id));
  return (ids.has(s as any) ? (s as PublicChannelId) : "general") as PublicChannelId;
}

export function labelForPublicChannel(id: PublicChannelId): string {
  return PUBLIC_CHANNELS.find((c) => c.id === id)?.label ?? "General";
}
