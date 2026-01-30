"use client";

import type { SuggestedCircle } from "@/src/lib/circleSuggestions";

type CachePayload = {
  ts: number;
  suggestions: SuggestedCircle[];
};

const KEY_PREFIX = "siddes.suggested_sets.cache.v1";

function key(viewerKey: string): string {
  const v = String(viewerKey || "anon").trim() || "anon";
  return `${KEY_PREFIX}:${v}`;
}

function safeParse(raw: string | null): CachePayload | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object") return null;
    const ts = typeof j.ts === "number" ? j.ts : 0;
    const suggestions = Array.isArray(j.suggestions) ? j.suggestions : [];
    return { ts, suggestions };
  } catch {
    return null;
  }
}

function dedupeById(items: SuggestedCircle[]): SuggestedCircle[] {
  const out: SuggestedCircle[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const id = String((it as any)?.id || "").trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const label = String((it as any)?.label || "").trim();
    const reason = String((it as any)?.reason || "").trim();
    const members = Array.isArray((it as any)?.members) ? (it as any).members.map((m: any) => String(m || "").trim()).filter(Boolean) : [];
    const color = (it as any)?.color || "emerald";
    const side = (it as any)?.side;

    out.push({ id, label, reason, members, color, side } as any);
  }
  return out;
}

export function saveSuggestedCirclesCache(viewerKey: string, suggestions: SuggestedCircle[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: CachePayload = {
      ts: Date.now(),
      suggestions: dedupeById(Array.isArray(suggestions) ? suggestions : []),
    };
    window.localStorage.setItem(key(viewerKey), JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadSuggestedCirclesCache(viewerKey: string, maxAgeDays = 30): SuggestedCircle[] {
  if (typeof window === "undefined") return [];
  try {
    const payload = safeParse(window.localStorage.getItem(key(viewerKey)));
    if (!payload) return [];
    const maxAgeMs = Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
    if (payload.ts && Date.now() - payload.ts > maxAgeMs) return [];
    return dedupeById(payload.suggestions);
  } catch {
    return [];
  }
}

export function clearSuggestedCirclesCache(viewerKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(viewerKey));
  } catch {
    // ignore
  }
}
