"use client";

import type { CircleColor } from "@/src/lib/circleThemes";
import type { SideId } from "@/src/lib/sides";

export type CircleId = string;

export type CircleDef = {
  id: CircleId;
  // Sets are curated sets inside a Side. Today we mostly surface them on Friends,
  // but the endgame is Side-scoped Sets/Subsides across contexts.
  side: SideId;
  label: string;
  color: CircleColor;
  members: string[];
  count: number;
  // Optional: server-provided (true when viewer owns the Set).
  isOwner?: boolean;
};

const STORAGE_KEY = "sd.circles.v0";

export const DEFAULT_CIRCLES: CircleDef[] =
  process.env.NODE_ENV === "production"
    ? []
    : [
        { id: "gym", side: "friends", label: "Gym Squad", color: "orange", members: ["@marc_us", "@sara_j"], count: 3 },
        { id: "weekend", side: "friends", label: "Weekend Crew", color: "purple", members: ["@marc_us", "@elena"], count: 1 },
      ];

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeSet(obj: any): CircleDef | null {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.id !== "string" || typeof obj.label !== "string") return null;
  const sideRaw = typeof obj.side === "string" ? obj.side.toLowerCase() : "friends";
  const side: SideId = ("public,friends,close,work".split(",") as SideId[]).includes(sideRaw as SideId)
    ? (sideRaw as SideId)
    : "friends";
  let color = (obj.color as CircleColor) || "orange";
  // Chameleon law: Blue is reserved for the Public Side. Sets cannot use it.
  if (color === "blue") color = "slate";
  const members = Array.isArray(obj.members) ? obj.members.filter((x: any) => typeof x === "string") : [];
  const count = typeof obj.count === "number" && Number.isFinite(obj.count) ? obj.count : 0;
  return { id: obj.id, side, label: obj.label, color, members, count };
}

export function loadCircles(): CircleDef[] {
  if (!hasWindow()) return DEFAULT_CIRCLES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CIRCLES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CIRCLES;
    const stored = parsed.map(safeSet).filter(Boolean) as CircleDef[];

    const byId = new Map(stored.map((s) => [s.id, s]));
    for (const d of DEFAULT_CIRCLES) {
      if (!byId.has(d.id)) byId.set(d.id, d);
    }
    return Array.from(byId.values());
  } catch {
    return DEFAULT_CIRCLES;
  }
}

export function saveCircles(sets: CircleDef[]) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  } catch {
    // ignore
  }
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

export function pickCircleColor(label: string): CircleColor {
  const l = label.toLowerCase();
  if (l.includes("gym") || l.includes("fit")) return "orange";
  if (l.includes("week") || l.includes("party")) return "purple";
  if (l.includes("family")) return "rose";
  if (l.includes("work") || l.includes("colleague") || l.includes("team")) return "slate";
  return "emerald";
}

export function createCircle(label: string, members: string[], side: SideId = "friends"): CircleDef {
  const base = slugify(label) || "set";
  const id = `${base}-${Date.now().toString(36)}`;
  return { id, side, label, color: pickCircleColor(label), members, count: 0 };
}

export function bulkAddSets(
  existing: CircleDef[],
  adds: Array<{ id?: string; side?: SideId; label: string; color: CircleColor; members: string[]; count?: number }>
): CircleDef[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const a of adds) {
    const id = a.id || `${slugify(a.label) || "set"}-${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
    if (byId.has(id)) continue;
    byId.set(id, { id, side: a.side || "friends", label: a.label, color: a.color, members: a.members, count: a.count ?? 0 });
  }
  return Array.from(byId.values());
}
