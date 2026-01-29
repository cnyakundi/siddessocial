"use client";

import type { CreateSetInput, SetsListOpts, UpdateSetPatch } from "@/src/lib/setsProvider";
import type { SetDef } from "@/src/lib/sets";
import type { SideId } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import type { SetEvent } from "@/src/lib/setEvents";
import { appendSetEvent, loadSetEvents, ensureCreatedEvent } from "@/src/lib/setEvents";
import { loadSets, saveSets, createSet, pickSetColor } from "@/src/lib/sets";

type LocalSetsProvider = {
  name: "local";
  list: (opts?: SetsListOpts) => Promise<SetDef[]>;
  get: (id: string) => Promise<SetDef | null>;
  create: (input: CreateSetInput) => Promise<SetDef>;
  bulkCreate: (inputs: CreateSetInput[]) => Promise<SetDef[]>;
  update: (id: string, patch: UpdateSetPatch) => Promise<SetDef | null>;
  leave: (id: string) => Promise<SetDef | null>;
  events: (id: string) => Promise<SetEvent[]>;
};

const VALID_SIDES: SideId[] = ["public", "friends", "close", "work"];
const VALID_COLORS: SetColor[] = ["orange", "purple", "blue", "emerald", "rose", "slate"];

function coerceSide(raw: any): SideId {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return (VALID_SIDES as string[]).includes(v) ? (v as SideId) : "friends";
}

function coerceColor(raw: any, side: SideId): SetColor {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  let c: SetColor = (VALID_COLORS as string[]).includes(v) ? (v as SetColor) : "emerald";
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
 * localSetsProvider
 * - Uses frontend/src/lib/sets.ts localStorage helpers (loadSets/saveSets).
 * - Records history via appendSetEvent (required by sets_provider_events_check.sh).
 */
export const localProvider: LocalSetsProvider = {
  name: "local",

  async list(opts?: SetsListOpts): Promise<SetDef[]> {
    const all = loadSets();
    const side = (opts as any)?.side ? coerceSide((opts as any).side) : null;
    return side ? all.filter((s) => s.side === side) : all;
  },

  async get(id: string): Promise<SetDef | null> {
    const all = loadSets();
    const hit = all.find((s) => s.id === id);
    return hit || null;
  },

  async create(input: CreateSetInput): Promise<SetDef> {
    const side = coerceSide(input.side || "friends");
    const members = normalizeMembers(input.members || []);
    const base = createSet(String(input.label || "Set"), members, side);

    const color = coerceColor(input.color || base.color || pickSetColor(base.label), side);
    const set: SetDef = { ...base, side, color, members, isOwner: true };

    const all = loadSets();
    saveSets([...all, set]);

    // History
    ensureCreatedEvent(set, "me");
    appendSetEvent(set.id, "created", "me", { label: set.label, side: set.side, color: set.color, members: set.members });

    return set;
  },

  async bulkCreate(inputs: CreateSetInput[]): Promise<SetDef[]> {
    const out: SetDef[] = [];
    for (const i of inputs || []) {
      out.push(await this.create(i));
    }
    return out;
  },

  async update(id: string, patch: UpdateSetPatch): Promise<SetDef | null> {
    const all = loadSets();
    const idx = all.findIndex((s) => s.id === id);
    if (idx < 0) return null;

    const prev = all[idx];
    const nextSide = patch.side ? coerceSide(patch.side) : prev.side;
    const nextLabel = typeof patch.label === "string" ? String(patch.label) : prev.label;
    const nextMembers = Array.isArray(patch.members) ? normalizeMembers(patch.members) : prev.members;
    const nextColor = patch.color ? coerceColor(patch.color, nextSide) : prev.color;

    const next: SetDef = {
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
    saveSets(all);

    // History events (best-effort, dev-only)
    if (changedLabel) appendSetEvent(id, "renamed", "me", { from: prev.label, to: next.label });
    if (changedMembers) appendSetEvent(id, "members_updated", "me", { from: prev.members, to: next.members });
    if (changedSide) appendSetEvent(id, "moved_side", "me", { from: prev.side, to: next.side });
    if (changedColor) appendSetEvent(id, "recolored", "me", { from: prev.color, to: next.color });

    return next;
  },

  async leave(id: string): Promise<SetDef | null> {
    const all = loadSets();
    const idx = all.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const prev = all[idx];

    // Local semantics: leaving removes it if you are owner; otherwise marks as not owner.
    const isOwner = prev.isOwner !== false;
    if (isOwner) {
      const nextAll = all.slice(0, idx).concat(all.slice(idx + 1));
      saveSets(nextAll);
      return null;
    }

    const next: SetDef = { ...prev, isOwner: false };
    all[idx] = next;
    saveSets(all);
    return next;
  },

  async events(id: string): Promise<SetEvent[]> {
    return loadSetEvents(id);
  },
};
