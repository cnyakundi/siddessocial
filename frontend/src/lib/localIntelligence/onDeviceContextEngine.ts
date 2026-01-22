"use client";

import type { SuggestedSet } from "@/src/lib/setSuggestions";
import type { SideId } from "@/src/lib/sides";

export const MAX_MEMBERS_PER_SUGGESTION = 24;
export const MAX_TOTAL_SUGGESTIONS = 8;

export type ContactMatch = {
  handle: string;
  display_name: string;
  hint?: {
    kind?: string | null;
    domain?: string | null;
    workish?: boolean;
  };
};

function normHandle(h: string): string {
  const s = String(h || "").trim().toLowerCase();
  if (!s) return "";
  return s.startsWith("@") ? s : `@${s}`;
}

function normalizeMembers(handles: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of handles || []) {
    const v = normHandle(String(h || ""));
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= MAX_MEMBERS_PER_SUGGESTION) break;
  }
  return out;
}

function suggestionRank(id: string): number {
  const s = String(id || "");
  if (s.startsWith("local_work_")) return 0;
  if (s.startsWith("local_family_")) return 1;
  if (s.startsWith("local_cluster_")) return 2;
  if (s.startsWith("local_friends_")) return 3;
  return 9;
}

function titleCase(s: string): string {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function domainBrand(domain: string): string {
  const d = String(domain || "").trim().toLowerCase();
  if (!d || !d.includes(".")) return "";
  const first = d.split(".")[0] || "";
  const clean = first.replace(/[^a-z0-9_-]/g, "");
  return clean || first;
}

function stableId(prefix: string, key: string): string {
  // simple deterministic hash (FNV-1a-ish) for stable ids across reloads
  const s = `${prefix}:${key}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).slice(0, 8);
  return `${prefix}_${hex}`;
}

function coerceSide(side: SideId | undefined, color: SuggestedSet["color"]): SideId {
  if (side) return side;
  if (color === "slate") return "work";
  if (color === "rose") return "close";
  if (color === "blue") return "public";
  return "friends";
}

function extractSurname(displayName: string): string | null {
  const raw = String(displayName || "").trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  const cleaned = last.replace(/[^A-Za-z\-']/g, "").trim();
  if (cleaned.length < 3) return null;
  return cleaned;
}

function tokenise(text: string): string[] {
  const raw = String(text || "").toLowerCase();
  if (!raw) return [];
  const bits = raw
    .split(/[^a-z0-9']+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const STOP = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "you",
    "your",
    "our",
    "their",
    "mr",
    "mrs",
    "ms",
    "dr",
    "prof",
    "sir",
    "madam",
    "eng",
    "ltd",
    "limited",
    "inc",
    "company",
    "co",
    "group",
    "team",
  ]);

  const out: string[] = [];
  for (const b of bits) {
    if (b.length < 3) continue;
    if (STOP.has(b)) continue;
    if (/^\d+$/.test(b)) continue;
    out.push(b);
  }
  return out;
}

class DSU {
  parent: number[];
  size: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = Array.from({ length: n }, () => 1);
  }
  find(x: number): number {
    let p = this.parent[x];
    while (p !== this.parent[p]) p = this.parent[p];
    while (x !== p) {
      const nx = this.parent[x];
      this.parent[x] = p;
      x = nx;
    }
    return p;
  }
  union(a: number, b: number) {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return;
    if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    this.size[ra] += this.size[rb];
  }
}

function bestClusterToken(
  idxs: number[],
  people: Array<{ tokens: Set<string> }>,
  globalFreq: Map<string, number>
): string | null {
  const BAD = new Set(["ltd", "limited", "inc", "company", "co", "group", "team"]);
  const score = new Map<string, number>();

  for (const i of idxs) {
    for (const t of people[i].tokens) {
      if (BAD.has(t)) continue;
      const f = globalFreq.get(t) || 1;
      score.set(t, (score.get(t) || 0) + 1 / f);
    }
  }

  let best: string | null = null;
  let bestScore = 0;
  for (const [t, sc] of score.entries()) {
    if (sc > bestScore) {
      best = t;
      bestScore = sc;
    }
  }
  if (!best) return null;
  if (best.length < 3) return null;
  return best;
}

/**
 * Local-first suggestion engine (on-device).
 * Returns review-first Suggested Sets that can be accepted into real Sets.
 */
export function suggestSetsFromMatches(matches: ContactMatch[]): SuggestedSet[] {
  const m = Array.isArray(matches) ? matches : [];
  const cleaned = m
    .map((x) => ({
      handle: normHandle(x?.handle || ""),
      display_name: String(x?.display_name || "").trim(),
      hint: x?.hint && typeof x.hint === "object" ? x.hint : undefined,
    }))
    .filter((x) => x.handle);

  const uniqueByHandle = new Map<string, typeof cleaned[number]>();
  for (const x of cleaned) {
    if (!uniqueByHandle.has(x.handle)) uniqueByHandle.set(x.handle, x);
  }

  const uniq = Array.from(uniqueByHandle.values());
  if (uniq.length < 2) return [];

  const out: SuggestedSet[] = [];
  const used = new Set<string>();

  // 1) Work clusters: group by work-ish email domain
  const byDomain = new Map<string, string[]>();
  for (const x of uniq) {
    const dom = String(x.hint?.domain || "").trim().toLowerCase();
    const workish = !!x.hint?.workish;
    if (!dom || !workish) continue;
    const arr = byDomain.get(dom) || [];
    arr.push(x.handle);
    byDomain.set(dom, arr);
  }

  for (const [dom, handles] of byDomain.entries()) {
    const members = normalizeMembers(handles);
    if (members.length < 2) continue;

    const brand = domainBrand(dom);
    const label = brand ? `${titleCase(brand)} Team` : "Work";
    const id = stableId("local_work", dom);

    members.forEach((h) => used.add(h));

    out.push({
      id,
      label,
      side: coerceSide("work", "slate"),
      color: "slate",
      members,
      reason: "Suggested from your contacts: same work email domain",
    });
  }

  // 2) Close clusters: surname groups (light heuristic)
  const bySurname = new Map<string, string[]>();
  for (const x of uniq) {
    const sn = extractSurname(x.display_name);
    if (!sn) continue;
    const key = sn.toLowerCase();
    const arr = bySurname.get(key) || [];
    arr.push(x.handle);
    bySurname.set(key, arr);
  }

  for (const [sn, handles] of bySurname.entries()) {
    const members = normalizeMembers(handles);
    if (members.length < 2) continue;

    const remaining = members.filter((h) => !used.has(h));
    if (remaining.length < 2) continue;

    const label = `${titleCase(sn)} Family`;
    const id = stableId("local_family", sn);

    remaining.forEach((h) => used.add(h));

    out.push({
      id,
      label,
      side: coerceSide("close", "rose"),
      color: "rose",
      members: remaining,
      reason: "Suggested from your contacts: same surname",
    });
  }

  // 3) Token clusters (cheap, calm)
  const remainingPeople = uniq
    .filter((x) => !used.has(x.handle))
    .map((x) => {
      const tokens = new Set<string>([
        ...tokenise(x.display_name),
        ...tokenise(x.handle.replace(/^@/, "")),
      ]);
      return { handle: x.handle, tokens };
    });

  if (remainingPeople.length >= 4) {
    const globalFreq = new Map<string, number>();
    for (const p of remainingPeople) {
      for (const t of p.tokens) globalFreq.set(t, (globalFreq.get(t) || 0) + 1);
    }

    const BAD = new Set(["ltd", "limited", "inc", "company", "co", "group", "team"]);
    const isStrong = (t: string) => {
      if (BAD.has(t)) return false;
      const f = globalFreq.get(t) || 0;
      return f > 0 && f <= 3 && t.length >= 4;
    };

    const tokenIndex = new Map<string, number[]>();
    for (let i = 0; i < remainingPeople.length; i++) {
      for (const t of remainingPeople[i].tokens) {
        if (!isStrong(t)) continue;
        const arr = tokenIndex.get(t) || [];
        arr.push(i);
        tokenIndex.set(t, arr);
      }
    }

    const dsu = new DSU(remainingPeople.length);

    const unionAll = (idxs: number[]) => {
      if (idxs.length < 2) return;
      const base = idxs[0];
      for (let j = 1; j < idxs.length; j++) dsu.union(base, idxs[j]);
    };

    // Link by rare strong token
    for (const idxs of tokenIndex.values()) unionAll(idxs);

    // Link by rare-pair signature (top-2 rarity tokens)
    const pairIndex = new Map<string, number[]>();
    for (let i = 0; i < remainingPeople.length; i++) {
      const toks = Array.from(remainingPeople[i].tokens).filter((t) => !BAD.has(t));
      toks.sort((a, b) => {
        const fa = globalFreq.get(a) || 999;
        const fb = globalFreq.get(b) || 999;
        return fa - fb || b.length - a.length || a.localeCompare(b);
      });
      const top = toks.slice(0, 2);
      if (top.length !== 2) continue;
      const key = `${top[0]}|${top[1]}`;
      const arr = pairIndex.get(key) || [];
      arr.push(i);
      pairIndex.set(key, arr);
    }
    for (const idxs of pairIndex.values()) {
      if (idxs.length >= 2 && idxs.length <= 5) unionAll(idxs);
    }

    const byRoot = new Map<number, number[]>();
    for (let i = 0; i < remainingPeople.length; i++) {
      const r = dsu.find(i);
      const arr = byRoot.get(r) || [];
      arr.push(i);
      byRoot.set(r, arr);
    }

    const clusters = Array.from(byRoot.values())
      .filter((idxs) => idxs.length >= 2)
      .sort((a, b) => b.length - a.length)
      .slice(0, 3);

    for (let k = 0; k < clusters.length; k++) {
      const idxs = clusters[k];
      const handles = idxs.map((i) => remainingPeople[i].handle);
      const members = normalizeMembers(handles);
      if (members.length < 2) continue;

      // Avoid "everyone" cluster
      if (members.length >= Math.max(8, Math.floor(remainingPeople.length * 0.7))) continue;

      const token = bestClusterToken(idxs, remainingPeople as any, globalFreq);
      const label = token ? `${titleCase(token)} Crew` : `Friends Group ${k + 1}`;

      const id = stableId("local_cluster", `${token || "friends"}:${members.slice().sort().join(",")}`);

      members.forEach((h) => used.add(h));

      out.push({
        id,
        label,
        side: coerceSide("friends", "emerald"),
        color: "emerald",
        members,
        reason: token ? `Suggested from your contacts: shared keyword (${titleCase(token)})` : "Suggested from your contacts: shared keywords",
      });
    }
  }

  // 4) Friends catchall
  const rem = normalizeMembers(uniq.map((x) => x.handle).filter((h) => !used.has(h)));
  if (rem.length >= 2) {
    const hasClusters = out.some((s) => String((s as any).id || "").startsWith("local_cluster_"));
    out.push({
      id: stableId("local_friends", rem.slice(0, 8).join(",")),
      label: hasClusters ? "More friends from your contacts" : "Friends from your contacts",
      side: coerceSide("friends", "emerald"),
      color: "emerald",
      members: rem,
      reason: `Suggested from your contacts: ${uniq.length} matches`,
    });
  }

  // Stable ordering + calm cap
  const ranked = out
    .slice()
    .sort((a, b) => {
      const ra = suggestionRank((a as any).id);
      const rb = suggestionRank((b as any).id);
      if (ra !== rb) return ra - rb;
      const la = String((a as any).label || "");
      const lb = String((b as any).label || "");
      return la.localeCompare(lb);
    })
    .slice(0, MAX_TOTAL_SUGGESTIONS);

  // DEV only: counts-only debug (no handles)
  const isDevHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (isDevHost) {
    try {
      // eslint-disable-next-line no-console
      console.debug("[CCE] suggestions", {
        total: ranked.length,
        work: ranked.filter((x) => String((x as any).id || "").startsWith("local_work_")).length,
        family: ranked.filter((x) => String((x as any).id || "").startsWith("local_family_")).length,
        clusters: ranked.filter((x) => String((x as any).id || "").startsWith("local_cluster_")).length,
        friends: ranked.filter((x) => String((x as any).id || "").startsWith("local_friends_")).length,
      });
    } catch {
      // ignore
    }
  }

  return ranked;
}
