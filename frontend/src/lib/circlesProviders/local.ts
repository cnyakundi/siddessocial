"use client";

import type { CreateCircleInput, CirclesListOpts, UpdateCirclePatch } from "@/src/lib/circlesProvider";
import type { CircleDef } from "@/src/lib/circles";
import type { SideId } from "@/src/lib/sides";
import type { CircleColor } from "@/src/lib/circleThemes";
import type { CircleEvent } from "@/src/lib/circleEvents";
import { appendCircleEvent, loadCircleEvents, ensureCreatedEvent } from "@/src/lib/circleEvents";
import { loadCircles, saveCircles, createCircle, pickCircleColor } from "@/src/lib/circles";

type LocalCirclesProvider = {
  name: "local";
  list: (opts?: CirclesListOpts) => Promise<CircleDef[]>;
  get: (id: string) => Promise<CircleDef | null>;
  create: (input: CreateCircleInput) => Promise<CircleDef>;
  bulkCreate: (inputs: CreateCircleInput[]) => Promise<CircleDef[]>;
  update: (id: string, patch: UpdateCirclePatch) => Promise<CircleDef | null>;
  leave: (id: string) => Promise<CircleDef | null>;
  events: (id: string) => Promise<CircleEvent[]>;
};

const VALID_SIDES: SideId[] = ["public", "friends", "close", "work"];
const VALID_COLORS: CircleColor[] = ["orange", "purple", "blue", "emerald", "rose", "slate"];

function coerceSide(raw: any): SideId {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return (VALID_SIDES as string[]).includes(v) ? (v as SideId) : "friends";
}

function coerceColor(raw: any, side: SideId): CircleColor {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  let c: CircleColor = (VALID_COLORS as string[]).includes(v) ? (v as CircleColor) : "emerald";
  // Chameleon law: Blue is reserved for Public; local Sets shouldn't use it.
  if (c === "blue" && side !== "public") c = "slate";
  return c;
}

function normHandle(s: string): string | null {
  const t = String(s || "").trim();
  if (!t) return null;
  const h = t.startsWith("@") ? t : "@" + t;
  const out = h.replace(/\s+/g, "").toLowerCase();
  if (out === "@") return null;
  return out.slice(0, 40);
}

function normalizeMembers(members: string[]): string[] {
  const arr = Array.isArray(members) ? members : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of arr) {
    const h = normHandle(String(m || ""));
    if (!h) continue;
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(h);
  }
  return out.slice(0, 64);
}

function isSameArr(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * localCirclesProvider
 * - Uses frontend/src/lib/sets.ts localStorage helpers (loadCircles/saveCircles).
 * - Records history via appendCircleEvent (required by sets_provider_events_check.sh).
 */
export const localProvider: LocalCirclesProvider = {
  name: "local",

  async list(opts?: CirclesListOpts): Promise<CircleDef[]> {
    const all = loadCircles();
    const side = (opts as any)?.side ? coerceSide((opts as any).side) : null;
    return side ? all.filter((s) => s.side === side) : all;
  },

  async get(id: string): Promise<CircleDef | null> {
    const all = loadCircles();
    const hit = all.find((s) => s.id === id);
    return hit || null;
  },

  async create(input: CreateCircleInput): Promise<CircleDef> {
    const side = coerceSide(input.side || "friends");
    const members = normalizeMembers(input.members || []);
    const base = createCircle(String(input.label || "Set"), members, side);

    const color = coerceColor(input.color || base.color || pickCircleColor(base.label), side);
    const set: CircleDef = { ...base, side, color, members, isOwner: true };

    const all = loadCircles();
    saveCircles([...all, set]);

    // History
    ensureCreatedEvent(set, "me");
    appendCircleEvent(set.id, "created", "me", { label: set.label, side: set.side, color: set.color, members: set.members });

    return set;
  },

  async bulkCreate(inputs: CreateCircleInput[]): Promise<CircleDef[]> {
    const out: CircleDef[] = [];
    for (const i of inputs || []) {
      out.push(await this.create(i));
    }
    return out;
  },

  async update(id: string, patch: UpdateCirclePatch): Promise<CircleDef | null> {
    const all = loadCircles();
    const idx = all.findIndex((s) => s.id === id);
    if (idx < 0) return null;

    const prev = all[idx];
    const nextSide = patch.side ? coerceSide(patch.side) : prev.side;
    const nextLabel = typeof patch.label === "string" ? String(patch.label) : prev.label;
    const nextMembers = Array.isArray(patch.members) ? normalizeMembers(patch.members) : prev.members;
    const nextColor = patch.color ? coerceColor(patch.color, nextSide) : prev.color;

    const next: CircleDef = {
      ...prev,
      side: nextSide,
      label: nextLabel,
      members: nextMembers,
      color: nextColor,
      count: Number.isFinite(prev.count) ? prev.count : 0,
      isOwner: prev.isOwner ?? true,
    };

    const changedLabel = prev.label !== next.label;
    const changedSide = prev.side !== next.side;
    const changedColor = prev.color !== next.color;
    const changedMembers = !isSameArr(prev.members || [], next.members || []);

    all[idx] = next;
    saveCircles(all);

    // History events (best-effort, dev-only)
    if (changedLabel) appendCircleEvent(id, "renamed", "me", { from: prev.label, to: next.label });
    if (changedMembers) appendCircleEvent(id, "members_updated", "me", { from: prev.members, to: next.members });
    if (changedSide) appendCircleEvent(id, "moved_side", "me", { from: prev.side, to: next.side });
    if (changedColor) appendCircleEvent(id, "recolored", "me", { from: prev.color, to: next.color });

    return next;
  },

  async leave(id: string): Promise<CircleDef | null> {
    const all = loadCircles();
    const idx = all.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const prev = all[idx];

    // Local semantics: leaving removes it if you are owner; otherwise marks as not owner.
    const isOwner = prev.isOwner !== false;
    if (isOwner) {
      const nextAll = all.slice(0, idx).concat(all.slice(idx + 1));
      saveCircles(nextAll);
      return null;
    }

    const next: CircleDef = { ...prev, isOwner: false };
    all[idx] = next;
    saveCircles(all);
    return next;
  },

  async events(id: string): Promise<CircleEvent[]> {
    return loadCircleEvents(id);
  },
};
