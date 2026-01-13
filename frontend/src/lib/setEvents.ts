"use client";

import type { SetDef, SetId } from "@/src/lib/sets";

export type SetEventKind = "created" | "renamed" | "members_updated" | "moved_side" | "recolored";

export type SetEvent = {
  id: string;
  setId: SetId;
  kind: SetEventKind;
  ts: number;
  by: string;
  data?: Record<string, any>;
};

const STORAGE_KEY = "sd.set_events.v0";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function makeId(prefix = "se"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isKind(x: any): x is SetEventKind {
  return x === "created" || x === "renamed" || x === "members_updated" || x === "moved_side" || x === "recolored";
}

function coerceEvent(x: any): SetEvent | null {
  if (!x || typeof x !== "object") return null;
  if (typeof x.id !== "string" || typeof x.setId !== "string") return null;
  if (!isKind((x as any).kind)) return null;
  const ts = typeof (x as any).ts === "number" && Number.isFinite((x as any).ts) ? (x as any).ts : Date.now();
  const by = typeof (x as any).by === "string" ? (x as any).by : "me";
  const data = (x as any).data && typeof (x as any).data === "object" ? (x as any).data : undefined;
  return { id: x.id, setId: x.setId, kind: (x as any).kind, ts, by, data };
}

function loadMap(): Record<string, any[]> {
  if (!hasWindow()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, any[]>;
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, any[]>) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function loadSetEvents(setId: SetId): SetEvent[] {
  if (!hasWindow()) return [];
  const map = loadMap();
  const arr = Array.isArray(map[setId]) ? map[setId] : [];
  const out = arr.map(coerceEvent).filter(Boolean) as SetEvent[];
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

export function appendSetEvent(
  setId: SetId,
  kind: SetEventKind,
  by: string,
  data?: Record<string, any>,
  ts?: number
): SetEvent | null {
  if (!hasWindow()) return null;
  const map = loadMap();
  const evt: SetEvent = {
    id: makeId(),
    setId,
    kind,
    ts: typeof ts === "number" && Number.isFinite(ts) ? ts : Date.now(),
    by: (by || "me").trim() || "me",
    data,
  };

  const prev = Array.isArray(map[setId]) ? map[setId] : [];
  map[setId] = [...prev, evt];
  saveMap(map);
  return evt;
}

export function ensureCreatedEvent(set: SetDef, by = "me") {
  if (!hasWindow()) return;
  const existing = loadSetEvents(set.id);
  if (existing.some((e) => e.kind === "created")) return;
  appendSetEvent(set.id, "created", by, { label: set.label, side: set.side });
}
