"use client";

import type { InviteAction, InviteDirection, InviteProvider, SetInvite } from "@/src/lib/inviteProvider";
import { emitCirclesChanged } from "@/src/lib/circlesSignals";
import type { SideId } from "@/src/lib/sides";

type ListResp = {
  ok?: boolean;
  restricted?: boolean;
  items?: any[];
};

type ItemResp = {
  ok?: boolean;
  restricted?: boolean;
  item?: any;
};

const VALID_SIDES: SideId[] = ["public", "friends", "close", "work"];
const VALID_STATUS: Array<SetInvite["status"]> = ["pending", "accepted", "rejected", "revoked"];

function coerceSide(raw: any): SideId {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return (VALID_SIDES as string[]).includes(v) ? (v as SideId) : "friends";
}

function coerceStatus(raw: any): SetInvite["status"] {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return (VALID_STATUS as string[]).includes(v) ? (v as any) : "pending";
}

function coerceInvite(x: any): SetInvite | null {
  if (!x || typeof x !== "object") return null;
  if (typeof x.id !== "string" || typeof x.setId !== "string") return null;
  if (typeof x.from !== "string" || typeof x.to !== "string") return null;

  const createdAt = typeof x.createdAt === "number" ? x.createdAt : Date.now();
  const updatedAt = typeof x.updatedAt === "number" ? x.updatedAt : createdAt;

  const setLabelRaw =
    typeof (x as any).setLabel === "string"
      ? (x as any).setLabel
      : typeof (x as any).set_label === "string"
        ? (x as any).set_label
        : "";
  const setLabel = String(setLabelRaw || "").trim();

  return {
    id: x.id,
    setId: x.setId,
    setLabel: setLabel || undefined,
    side: coerceSide(x.side),
    from: x.from,
    to: x.to,
    status: coerceStatus(x.status),
    message: typeof x.message === "string" ? x.message : undefined,
    createdAt,
    updatedAt,
  };
}

async function j<T>(res: Response): Promise<T> {
  const data = await res.json();
  return data as T;
}

function localOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost";
}

function buildUrl(path: string, direction?: InviteDirection, baseOverride?: string): string {
  const base = baseOverride || localOrigin();
  const u = new URL(path, base);
  if (direction && direction !== "all") u.searchParams.set("direction", direction);
  return u.toString();
}

// sd_231: Always SAME-ORIGIN Next API routes (/api/*). No cross-origin Django mode.
async function fetchSameOrigin(path: string, direction: InviteDirection | undefined, init: RequestInit): Promise<Response> {
  return fetch(buildUrl(path, direction, undefined), init);
}

export const backendStubProvider: InviteProvider = {
  name: "backend_stub",

  async list(opts?): Promise<SetInvite[]> {
    const direction = (opts?.direction || "all") as InviteDirection;
    const res = await fetchSameOrigin("/api/invites", direction, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new Error("Restricted (login required).");
    if (!res.ok) return [];
    const data = await j<ListResp>(res);
    if (data.restricted) throw new Error("Restricted (login required).");
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map(coerceInvite).filter(Boolean) as SetInvite[];
  },

  async get(id: string): Promise<SetInvite | null> {
    const safeId = encodeURIComponent(id);
    const res = await fetchSameOrigin(`/api/invites/${safeId}`, undefined, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new Error("Restricted (login required).");
    if (!res.ok) return null;
    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("Restricted (login required).");
    const item = coerceInvite((data as any).item);
    return item;
  },

  async create(input): Promise<SetInvite> {
    const body = {
      setId: input.setId,
      side: input.side,
      to: input.to,
      message: input.message,
    };
    const res = await fetchSameOrigin("/api/invites", undefined, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`invites:create failed (${res.status})`);
    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("invites:create restricted (not authenticated)");
    const item = coerceInvite((data as any).item);
    if (!item) throw new Error("invites:create invalid response");
    return item;
  },

  async act(id: string, action: InviteAction): Promise<SetInvite | null> {
    const safeId = encodeURIComponent(id);
    const res = await fetchSameOrigin(`/api/invites/${safeId}`, undefined, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`invites:act failed (${res.status})`);
    const data = await j<ItemResp>(res);
    if (data.restricted) throw new Error("invites:act restricted (not authenticated)");
    const item = coerceInvite((data as any).item);
    if (item && action === "accept" && item.status === "accepted") {
      emitCirclesChanged();
    }
    return item;
  },
};
