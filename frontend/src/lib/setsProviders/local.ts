"use client";

import type { CreateSetInput, SetsListOpts, SetsProvider, UpdateSetPatch } from "@/src/lib/setsProvider";
import type { SetColor } from "@/src/lib/setThemes";
import type { SideId } from "@/src/lib/sides";
import { bulkAddSets, createSet, loadSets, saveSets, type SetDef } from "@/src/lib/sets";
import { appendSetEvent, ensureCreatedEvent, loadSetEvents, type SetEvent } from "@/src/lib/setEvents";

function mergeUnique(preferred: SetDef[], rest: SetDef[]): SetDef[] {
  const byId = new Map(preferred.map((s) => [s.id, s]));
  for (const s of rest) {
    if (!byId.has(s.id)) byId.set(s.id, s);
  }
  return Array.from(byId.values());
}

function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function filterBySide(sets: SetDef[], side?: SideId): SetDef[] {
  if (!side) return sets;
  return sets.filter((s) => s.side === side);
}

function normalizeMembers(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => String(m)).map((m) => m.trim()).filter(Boolean);
}

export const localProvider: SetsProvider = {
  name: "local",

  async list(opts?: SetsListOpts): Promise<SetDef[]> {
    const all = loadSets();
    return filterBySide(all, opts?.side);
  },

  async get(id: string): Promise<SetDef | null> {
    const all = loadSets();
    return all.find((s) => s.id === id) || null;
  },

  async create(input: CreateSetInput): Promise<SetDef> {
    const side = input.side || "friends";
    const existing = loadSets();

    // Allow callers to force a color (suggested sets), otherwise pick via heuristic.
    const created = input.color
      ? { ...createSet(input.label, input.members, side), color: input.color }
      : createSet(input.label, input.members, side);

    const next = mergeUnique([created], existing);
    saveSets(next);

    // History (local): record at least a created event.
    ensureCreatedEvent(created, "me");

    return created;
  },

  async bulkCreate(inputs: CreateSetInput[]): Promise<SetDef[]> {
    if (!inputs.length) return [];

    const existing = loadSets();
    const adds = inputs.map((i) => ({
      side: i.side || "friends",
      label: i.label,
      color: (i.color as SetColor) || "emerald",
      members: i.members,
      count: 0,
    }));

    const next = bulkAddSets(existing, adds);
    saveSets(next);

    // Return the created ones (best-effort) by taking ids not in existing.
    const created = next.filter((s) => !existing.some((e) => e.id === s.id));
    for (const s of created) {
      ensureCreatedEvent(s, "me");
    }

    return created;
  },

  async update(id: string, patch: UpdateSetPatch): Promise<SetDef | null> {
    const all = loadSets();
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const prev = all[idx];
    const next: SetDef = { ...prev };

    if (typeof patch.label === "string" && patch.label.trim()) {
      next.label = patch.label;
    }

    if (typeof patch.side === "string") {
      const v = patch.side.toLowerCase().trim();
      if (v === "public" || v === "friends" || v === "close" || v === "work") {
        next.side = v as SideId;
      }
    }

    if (typeof patch.color === "string" && patch.color.trim()) {
      next.color = patch.color as SetColor;
    }

    if (Array.isArray(patch.members)) {
      next.members = normalizeMembers(patch.members);
    }

    // Update state
    const updated = all.slice();
    updated[idx] = next;
    saveSets(updated);

    // Local history events
    ensureCreatedEvent(prev, "me");

    if (next.label !== prev.label) {
      appendSetEvent(id, "renamed", "me", { from: prev.label, to: next.label });
    }

    if (!sameMembers(next.members, prev.members)) {
      appendSetEvent(id, "members_updated", "me", { from: prev.members, to: next.members });
    }

    if (next.side !== prev.side) {
      appendSetEvent(id, "moved_side", "me", { from: prev.side, to: next.side });
    }

    if (next.color !== prev.color) {
      appendSetEvent(id, "recolored", "me", { from: prev.color, to: next.color });
    }

    return next;
  },

  async events(id: string): Promise<SetEvent[]> {
    // Ensure defaults have at least a created event.
    const set = loadSets().find((s) => s.id === id);
    if (set) ensureCreatedEvent(set, "me");
    return loadSetEvents(id);
  },
};
