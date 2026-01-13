/**
 * In-memory sets store (dev/stub).
 * Persists only for the lifetime of the Next.js node process.
 *
 * Sets are "rooms" inside a Side (Friends/Close/Work/Public). Today they are
 * user-scoped and only readable/writable by `viewerRole=me` in stub mode.
 *
 * Includes a simple per-set event log to prep history UI.
 */

import type { SideId } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";

export type StoredSet = {
  id: string;
  side: SideId;
  label: string;
  color: SetColor;
  members: string[];
  count: number;
  createdAt: number;
  updatedAt: number;
};

export type StoredSetEvent = {
  id: string;
  setId: string;
  kind: "created" | "renamed" | "members_updated" | "moved_side" | "recolored";
  ts: number;
  by: string;
  data?: Record<string, any>;
};

export type ListSetsOpts = { side?: SideId };

export type CreateSetInput = {
  side: SideId;
  label: string;
  members: string[];
  color?: SetColor;
};

export type UpdateSetPatch = Partial<Pick<StoredSet, "side" | "label" | "members" | "color">>;

type ViewerState = {
  sets: StoredSet[];
  events: StoredSetEvent[];
};

const BY_VIEWER = new Map<string, ViewerState>();

function now(): number {
  return Date.now();
}

function newSetId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function newEventId() {
  return `se_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

function pickSetColor(label: string): SetColor {
  const l = label.toLowerCase();
  if (l.includes("gym") || l.includes("fit")) return "orange";
  if (l.includes("week") || l.includes("party")) return "purple";
  if (l.includes("family")) return "rose";
  if (l.includes("work") || l.includes("colleague") || l.includes("team")) return "slate";
  return "emerald";
}

function seedDefaults(viewerId: string): ViewerState {
  const t = now();
  const defaults: StoredSet[] = [
    {
      id: "gym",
      side: "friends",
      label: "Gym Squad",
      color: "orange",
      members: ["@marc_us", "@sara_j"],
      count: 3,
      createdAt: t - 86400_000 * 6,
      updatedAt: t - 86400_000 * 2,
    },
    {
      id: "weekend",
      side: "friends",
      label: "Weekend Crew",
      color: "purple",
      members: ["@marc_us", "@elena"],
      count: 1,
      createdAt: t - 86400_000 * 10,
      updatedAt: t - 86400_000 * 1,
    },
  ];

  const events: StoredSetEvent[] = defaults.map((s) => ({
    id: newEventId(),
    setId: s.id,
    kind: "created",
    ts: s.createdAt,
    by: viewerId,
    data: { label: s.label, side: s.side },
  }));

  return { sets: defaults, events };
}

function ensureViewer(viewerId: string): ViewerState {
  const v = (viewerId || "").trim() || "anon";
  if (!BY_VIEWER.has(v)) {
    BY_VIEWER.set(v, seedDefaults(v));
  }
  return BY_VIEWER.get(v)!;
}

export function listSets(viewerId: string, opts?: ListSetsOpts): StoredSet[] {
  const st = ensureViewer(viewerId);
  const side = opts?.side;
  const items = side ? st.sets.filter((s) => s.side === side) : st.sets.slice();
  // stable-ish ordering: recently updated first
  items.sort((a, b) => b.updatedAt - a.updatedAt);
  return items;
}

export function getSet(viewerId: string, id: string): StoredSet | null {
  const st = ensureViewer(viewerId);
  return st.sets.find((s) => s.id === id) || null;
}

export function listSetEvents(viewerId: string, setId: string): StoredSetEvent[] {
  const st = ensureViewer(viewerId);
  return st.events.filter((e) => e.setId === setId).sort((a, b) => b.ts - a.ts);
}

export function createSet(viewerId: string, input: CreateSetInput): StoredSet {
  const st = ensureViewer(viewerId);
  const t = now();

  const base = slugify(input.label) || "set";
  const id = `${base}-${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const item: StoredSet = {
    id,
    side: input.side,
    label: input.label,
    color: input.color || pickSetColor(input.label),
    members: (input.members || []).filter((m) => typeof m === "string"),
    count: 0,
    createdAt: t,
    updatedAt: t,
  };

  st.sets.push(item);
  st.events.push({
    id: newEventId(),
    setId: item.id,
    kind: "created",
    ts: t,
    by: viewerId,
    data: { label: item.label, side: item.side },
  });

  return item;
}

export function bulkCreateSets(viewerId: string, inputs: CreateSetInput[]): StoredSet[] {
  const made: StoredSet[] = [];
  for (const input of inputs) {
    made.push(createSet(viewerId, input));
  }
  return made;
}

export function updateSet(viewerId: string, id: string, patch: UpdateSetPatch): StoredSet | null {
  const st = ensureViewer(viewerId);
  const item = st.sets.find((s) => s.id === id);
  if (!item) return null;

  const t = now();

  if (typeof patch.label === "string" && patch.label.trim() && patch.label !== item.label) {
    const prev = item.label;
    item.label = patch.label;
    st.events.push({
      id: newEventId(),
      setId: id,
      kind: "renamed",
      ts: t,
      by: viewerId,
      data: { from: prev, to: item.label },
    });
  }

  if (Array.isArray(patch.members)) {
    const prev = item.members.slice();
    item.members = patch.members.filter((m) => typeof m === "string");
    st.events.push({
      id: newEventId(),
      setId: id,
      kind: "members_updated",
      ts: t,
      by: viewerId,
      data: { from: prev, to: item.members },
    });
  }

  if (typeof patch.side === "string" && patch.side !== item.side) {
    const prev = item.side;
    item.side = patch.side as SideId;
    st.events.push({
      id: newEventId(),
      setId: id,
      kind: "moved_side",
      ts: t,
      by: viewerId,
      data: { from: prev, to: item.side },
    });
  }

  if (typeof patch.color === "string" && patch.color !== item.color) {
    const prev = item.color;
    item.color = patch.color as SetColor;
    st.events.push({
      id: newEventId(),
      setId: id,
      kind: "recolored",
      ts: t,
      by: viewerId,
      data: { from: prev, to: item.color },
    });
  }

  item.updatedAt = t;
  return item;
}
