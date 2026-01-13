import type { SideId } from "@/src/lib/sides";

const MOCK_BY_SIDE: Record<SideId, string[]> = {
  public: ["@jordan", "@aisha", "@kim", "@mike"],
  friends: ["@jordan", "@aisha", "@elena", "@marc_us"],
  close: ["@aisha", "@kim"],
  work: ["@mike", "@jordan"],
};

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const t = (x || "").trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function suggestInviteHandles(side: SideId, currentMembers: string[]): string[] {
  const cur = new Set((currentMembers || []).map((x) => String(x || "").trim()));
  const pool = MOCK_BY_SIDE[side] || [];
  return uniq(pool).filter((h) => !cur.has(h));
}
