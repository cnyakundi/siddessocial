import type { SideId } from "@/src/lib/sides";

// sd_181m: DB-backed invite suggestions (no mock-by-side list).
// Source: GET /api/contacts/suggestions (cookie-forwarding proxy to backend)

function normalizeHandle(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (t.startsWith("@")) return t;
  return `@${t.replace(/^@+/, "")}`;
}

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const t = normalizeHandle(x);
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export async function fetchInviteSuggestionHandles(
  _side: SideId,
  currentMembers: string[]
): Promise<string[]> {
  const cur = new Set((currentMembers || []).map((x) => normalizeHandle(x)).filter(Boolean));

  try {
    const res = await fetch("/api/contacts/suggestions", { cache: "no-store" });
    const j = await res.json().catch(() => null);

    const items = Array.isArray((j as any)?.items) ? (j as any).items : [];
    const pool = uniq(
      items
        .map((x: any) => normalizeHandle(String(x?.handle || x?.name || "")))
        .filter(Boolean)
    );

    return pool.filter((h) => !cur.has(h)).slice(0, 40);
  } catch {
    return [];
  }
}
