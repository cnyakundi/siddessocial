"use client";

import type { CreateSetInput, SetsListOpts, SetsProvider, UpdateSetPatch } from "@/src/lib/setsProvider";
import type { SetDef } from "@/src/lib/sets";
import type { SideId } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import type { SetEvent, SetEventKind } from "@/src/lib/setEvents";

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
const VALID_COLORS: SetColor[] = ["orange", "purple", "blue", "emerald", "rose", "slate"];
const VALID_EVENT_KINDS: SetEventKind[] = ["created", "renamed", "members_updated", "moved_side", "recolored"];

function coerceSide(raw: any): SideId {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return (VALID_SIDES as string[]).includes(v) ? (v as SideId) : "friends";
}

function coerceColor(raw: any): SetColor {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return (VALID_COLORS as string[]).includes(v) ? (v as SetColor) : "emerald";
}

function coerceEventKind(raw: any): SetEventKind | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  return (VALID_EVENT_KINDS as string[]).includes(v) ? (v as SetEventKind) : null;
}

function coerceSet(x: any): SetDef | null {
  if (!x || typeof x !== "object") return null;
  if (typeof x.id !== "string" || typeof x.label !== "string") return null;
  const members = Array.isArray(x.members) ? x.members.filter((m: any) => typeof m === "string") : [];
  const count = typeof x.count === "number" && Number.isFinite(x.count) ? x.count : 0;
  return {
    id: x.id,
    side: coerceSide((x as any).side),
    label: x.label,
    color: coerceColor((x as any).color),
    members,
    count,
  };
}

function coerceEvent(x: any): SetEvent | null {
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

function normalizeApiBase(raw: string | undefined | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    // Keep only origin (we always pass absolute paths like /api/sets/...)
    return u.origin;
  } catch {
    return null;
  }
}

function isRemoteBase(base: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return new URL(base).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function escapeCookieName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, "\\$&");
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${escapeCookieName(name)}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

function withViewerHeader(init: RequestInit, viewer: string): RequestInit {
  const headers = new Headers(init.headers || {});
  headers.set("x-sd-viewer", viewer);
  return { ...init, headers };
}

function usesDjangoBase(): { enabled: boolean; base: string | null } {
  const base = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE);
  if (!base) return { enabled: false, base: null };
  // Only treat it as "django mode" when it points off-origin (docker dev).
  return { enabled: isRemoteBase(base), base };
}

function buildUrl(path: string, opts?: SetsListOpts, baseOverride?: string): string {
  const base = baseOverride || localOrigin();
  const u = new URL(path, base);

  const side = (opts as any)?.side as string | undefined;
  if (side) u.searchParams.set("side", side);

  return u.toString();
}

async function fetchWithFallback(path: string, opts: SetsListOpts | undefined, init: RequestInit): Promise<Response> {
  const django = usesDjangoBase();
  const viewer = getCookie("sd_viewer");
  const initWithViewer = viewer ? withViewerHeader(init, viewer) : init;

  // Primary: Django base (cross-origin) when configured.
  if (django.enabled && django.base) {
    try {
      const res = await fetch(buildUrl(path, opts, django.base), initWithViewer);
      if (res.status < 500) return res;
    } catch {
      // fall through to local stub
    }
  }

  // Fallback: Next.js stubs (same-origin).
  return fetch(buildUrl(path, opts, undefined), init);
}


export const backendStubProvider: SetsProvider = {
  name: "backend_stub",

  async list(opts?: SetsListOpts): Promise<SetDef[]> {
    const res = await fetchWithFallback("/api/sets", opts, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await j<ListResp>(res);
    if (data.restricted) return [];
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map(coerceSet).filter(Boolean) as SetDef[];
  },

  async get(id: string): Promise<SetDef | null> {
    const safeId = encodeURIComponent(id);
    const res = await fetchWithFallback(`/api/sets/${safeId}`, undefined, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await j<ItemResp>(res);
    if (data.restricted) return null;
    return coerceSet((data as any).item);
  },

  async create(input: CreateSetInput): Promise<SetDef> {
    const body = {
      side: input.side || "friends",
      label: input.label,
      members: input.members || [],
      color: input.color,
    };
    const res = await fetchWithFallback(`/api/sets`, undefined, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sets:create failed (${res.status})`);
    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("sets:create restricted (missing sd_viewer or not me)");
    const item = coerceSet((data as any).item || (Array.isArray(data.items) ? data.items[0] : null));
    if (!item) throw new Error("sets:create invalid response");
    return item;
  },

  async bulkCreate(inputs: CreateSetInput[]): Promise<SetDef[]> {
    const body = {
      inputs: (inputs || []).map((i) => ({
        side: i.side || "friends",
        label: i.label,
        members: i.members || [],
        color: i.color,
      })),
    };
    const res = await fetchWithFallback(`/api/sets`, undefined, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sets:bulkCreate failed (${res.status})`);
    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("sets:bulkCreate restricted (missing sd_viewer or not me)");
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map(coerceSet).filter(Boolean) as SetDef[];
  },

  async update(id: string, patch: UpdateSetPatch): Promise<SetDef | null> {
    const safeId = encodeURIComponent(id);
    const body: any = {};
    if (typeof patch.label === "string") body.label = patch.label;
    if (Array.isArray(patch.members)) body.members = patch.members;
    if (typeof patch.side === "string") body.side = patch.side;
    if (typeof patch.color === "string") body.color = patch.color;

    const res = await fetchWithFallback(`/api/sets/${safeId}`, undefined, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`sets:update failed (${res.status})`);

    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("sets:update restricted (missing sd_viewer or not me)");

    const item = coerceSet((data as any).item);
    return item || null;
  },

  async events(id: string): Promise<SetEvent[]> {
    const safeId = encodeURIComponent(id);
    const res = await fetchWithFallback(`/api/sets/${safeId}/events`, undefined, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await j<EventsResp>(res);
    if (data.restricted) return [];
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map(coerceEvent).filter(Boolean) as SetEvent[];
  },
};
