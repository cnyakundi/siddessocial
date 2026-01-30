"use client";

import type { CreateCircleInput, CirclesListOpts, CirclesProvider, UpdateCirclePatch } from "@/src/lib/circlesProvider";
import type { CircleDef } from "@/src/lib/circles";
import type { SideId } from "@/src/lib/sides";
import type { CircleColor } from "@/src/lib/circleThemes";
import type { CircleEvent, CircleEventKind } from "@/src/lib/circleEvents";

type ListResp = {
  ok?: boolean;
  restricted?: boolean;
  items?: any[];
};

type ItemResp = {
  ok?: boolean;
  restricted?: boolean;
  item?: any;
  items?: any[];
};

type EventsResp = {
  ok?: boolean;
  restricted?: boolean;
  items?: any[];
};

const VALID_SIDES: SideId[] = ["public", "friends", "close", "work"];
const VALID_COLORS: CircleColor[] = ["orange", "purple", "blue", "emerald", "rose", "slate"];
const VALID_EVENT_KINDS: CircleEventKind[] = ["created", "renamed", "members_updated", "moved_side", "recolored"];

function coerceSide(raw: any): SideId {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return (VALID_SIDES as string[]).includes(v) ? (v as SideId) : "friends";
}

function coerceColor(raw: any): CircleColor {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return (VALID_COLORS as string[]).includes(v) ? (v as CircleColor) : "emerald";
}

function coerceEventKind(raw: any): CircleEventKind | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  return (VALID_EVENT_KINDS as string[]).includes(v) ? (v as CircleEventKind) : null;
}

function coerceSet(x: any): CircleDef | null {
  if (!x || typeof x !== "object") return null;
  if (typeof x.id !== "string" || typeof x.label !== "string") return null;
  const members = Array.isArray(x.members) ? x.members.filter((m: any) => typeof m === "string") : [];
  const count = typeof x.count === "number" && Number.isFinite(x.count) ? x.count : 0;
  const isOwner = typeof (x as any).isOwner === "boolean" ? (x as any).isOwner : undefined;
  return {
    id: x.id,
    side: coerceSide((x as any).side),
    label: x.label,
    color: coerceColor((x as any).color),
    members,
    count,
    isOwner,
  };
}

function coerceEvent(x: any): CircleEvent | null {
  if (!x || typeof x !== "object") return null;
  if (typeof x.id !== "string" || typeof x.setId !== "string") return null;
  const kind = coerceEventKind((x as any).kind);
  if (!kind) return null;
  const ts = typeof (x as any).ts === "number" && Number.isFinite((x as any).ts) ? (x as any).ts : Date.now();
  const by = typeof (x as any).by === "string" ? (x as any).by : "me";
  const data = (x as any).data && typeof (x as any).data === "object" ? (x as any).data : undefined;
  return { id: x.id, setId: x.setId, kind, ts, by, data };
}

async function j<T>(res: Response): Promise<T> {
  const data = await res.json();
  return data as T;
}

function localOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost";
}

function buildUrl(path: string, opts?: CirclesListOpts, baseOverride?: string): string {
  const base = baseOverride || localOrigin();
  const u = new URL(path, base);

  const side = (opts as any)?.side as string | undefined;
  if (side) u.searchParams.set("side", side);

  return u.toString();
}

// sd_231: Always SAME-ORIGIN Next API routes (/api/*). No cross-origin Django mode.
async function fetchSameOrigin(path: string, opts: CirclesListOpts | undefined, init: RequestInit): Promise<Response> {
  return fetch(buildUrl(path, opts, undefined), init);
}

export const backendStubProvider: CirclesProvider = {
  name: "backend_stub",

  async list(opts?: CirclesListOpts): Promise<CircleDef[]> {
    const res = await fetchSameOrigin("/api/circles", opts, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new Error("Restricted (login required).");
    if (!res.ok) return [];
    const data = await j<ListResp>(res);
    if (data.restricted) throw new Error("Restricted (login required).");
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map(coerceSet).filter(Boolean) as CircleDef[];
  },

  async get(id: string): Promise<CircleDef | null> {
    const safeId = encodeURIComponent(id);
    const res = await fetchSameOrigin(`/api/circles/${safeId}`, undefined, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new Error("Restricted (login required).");
    if (!res.ok) return null;
    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("Restricted (login required).");
    return coerceSet((data as any).item);
  },

  async create(input: CreateCircleInput): Promise<CircleDef> {
    const body = {
      side: input.side || "friends",
      label: input.label,
      members: input.members || [],
      color: input.color,
    };
    const res = await fetchSameOrigin(`/api/circles`, undefined, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sets:create failed (${res.status})`);
    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("sets:create restricted (not authenticated)");
    const item = coerceSet((data as any).item || (Array.isArray(data.items) ? data.items[0] : null));
    if (!item) throw new Error("sets:create invalid response");
    return item;
  },

  async bulkCreate(inputs: CreateCircleInput[]): Promise<CircleDef[]> {
    const body = {
      inputs: (inputs || []).map((i) => ({
        side: i.side || "friends",
        label: i.label,
        members: i.members || [],
        color: i.color,
      })),
    };
    const res = await fetchSameOrigin(`/api/circles`, undefined, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sets:bulkCreate failed (${res.status})`);
    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("sets:bulkCreate restricted (not authenticated)");
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map(coerceSet).filter(Boolean) as CircleDef[];
  },


  async leave(id: string): Promise<CircleDef | null> {
    const safeId = encodeURIComponent(id);
    const res = await fetchSameOrigin("/api/circles/" + safeId + "/leave", undefined, { method: "POST" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("sets:leave failed (" + res.status + ")");
    const data = await j<ItemResp>(res);
    if ((data as any).restricted) throw new Error("sets:leave restricted (not authenticated)");
    const item = coerceSet((data as any).item);
    return item || null;
  },

  async update(id: string, patch: UpdateCirclePatch): Promise<CircleDef | null> {
    const safeId = encodeURIComponent(id);
    const body: any = {};
    if (typeof patch.label === "string") body.label = patch.label;
    if (Array.isArray(patch.members)) body.members = patch.members;
    if (typeof patch.side === "string") body.side = patch.side;
    if (typeof patch.color === "string") body.color = patch.color;

    const res = await fetchSameOrigin(`/api/circles/${safeId}`, undefined, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`sets:update failed (${res.status})`);

    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("sets:update restricted (not authenticated)");

    const item = coerceSet((data as any).item);
    return item || null;
  },

  async events(id: string): Promise<CircleEvent[]> {
    const safeId = encodeURIComponent(id);
    const res = await fetchSameOrigin(`/api/circles/${safeId}/events`, undefined, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new Error("Restricted (login required).");
    if (!res.ok) return [];
    const data = await j<EventsResp>(res);
    if (data.restricted) throw new Error("Restricted (login required).");
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map(coerceEvent).filter(Boolean) as CircleEvent[];
  },
};
