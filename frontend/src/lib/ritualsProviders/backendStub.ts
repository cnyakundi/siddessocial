"use client";

// sd_338: Same-origin Rituals provider (Next API proxy -> Django)

import type { CreateRitualInput, RespondInput, RitualsDockOpts, RitualsProvider } from "@/src/lib/ritualsProvider";
import type { RitualItem, RitualResponseItem } from "@/src/lib/ritualsTypes";
import { isSideId, type SideId } from "@/src/lib/sides";
import { RestrictedError, isRestrictedPayload } from "@/src/lib/restricted";


type DockResp = {
  ok?: boolean;
  restricted?: boolean;
  items?: any[];
};

type ItemResp = {
  ok?: boolean;
  restricted?: boolean;
  ritual?: any;
};

type ResponsesResp = {
  ok?: boolean;
  restricted?: boolean;
  items?: any[];
};

function coerceSide(raw: any): SideId {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return isSideId(v) ? (v as SideId) : "public";
}

function coerceRitual(x: any): RitualItem | null {
  if (!x || typeof x !== "object") return null;
  if (typeof x.id !== "string") return null;
  const side = coerceSide((x as any).side);
  return {
    id: x.id,
    kind: String((x as any).kind || ""),
    title: String((x as any).title || ""),
    prompt: String((x as any).prompt || ""),
    status: String((x as any).status || ""),
    side,
    setId: typeof (x as any).setId === "string" ? (x as any).setId : null,
    createdBy: String((x as any).createdBy || ""),
    createdAt: typeof (x as any).createdAt === "number" ? (x as any).createdAt : 0,
    expiresAt: typeof (x as any).expiresAt === "number" ? (x as any).expiresAt : null,
    igniteThreshold: typeof (x as any).igniteThreshold === "number" ? (x as any).igniteThreshold : 0,
    ignites: typeof (x as any).ignites === "number" ? (x as any).ignites : 0,
    replies: typeof (x as any).replies === "number" ? (x as any).replies : 0,
    data: (x as any).data && typeof (x as any).data === "object" ? (x as any).data : {},
  };
}

function coerceResponse(x: any): RitualResponseItem | null {
  if (!x || typeof x !== "object") return null;
  if (typeof x.id !== "string") return null;
  const payload = (x as any).payload && typeof (x as any).payload === "object" ? (x as any).payload : {};
  const byDisplay = (x as any).byDisplay && typeof (x as any).byDisplay === "object" ? (x as any).byDisplay : undefined;
  return {
    id: x.id,
    by: String((x as any).by || ""),
    byDisplay,
    createdAt: typeof (x as any).createdAt === "number" ? (x as any).createdAt : 0,
    kind: String((x as any).kind || ""),
    payload,
    text: String((x as any).text || ""),
  };
}

async function j<T>(res: Response): Promise<T> {
  const data = await res.json();
  return data as T;
}

function localOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost";
}

function buildUrl(path: string, opts?: RitualsDockOpts, baseOverride?: string): string {
  const base = baseOverride || localOrigin();
  const u = new URL(path, base);

  const side = (opts as any)?.side as string | undefined;
  if (side) u.searchParams.set("side", side);

  const setId = (opts as any)?.setId as string | null | undefined;
  if (setId) u.searchParams.set("setId", setId);

  return u.toString();
}

async function fetchSameOrigin(path: string, opts: RitualsDockOpts | undefined, init: RequestInit): Promise<Response> {
  return fetch(buildUrl(path, opts, undefined), init);
}

export const backendStubProvider: RitualsProvider = {
  name: "backend_stub",

  async dock(opts: RitualsDockOpts): Promise<{ restricted: boolean; items: RitualItem[] }> {
    const res = await fetchSameOrigin("/api/rituals", opts, { cache: "no-store" });
    const data = await j<DockResp>(res).catch(() => ({} as any));

    if (isRestrictedPayload(res, data)) {
      return { restricted: true, items: [] };
    }

    const items = Array.isArray((data as any).items) ? (data as any).items : [];
    return { restricted: false, items: items.map(coerceRitual).filter(Boolean) as RitualItem[] };
  },

  async get(id: string): Promise<RitualItem | null> {
    const safe = encodeURIComponent(id);
    const res = await fetchSameOrigin(`/api/rituals/${safe}`, undefined, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new RestrictedError(res.status, "Restricted (login required).");
    if (!res.ok) return null;
    const data = await j<ItemResp>(res).catch(() => ({} as any));
    if (isRestrictedPayload(res, data)) throw new RestrictedError(res.status, "Restricted (login required).");
    return coerceRitual((data as any).ritual);
  },

  async create(input: CreateRitualInput): Promise<RitualItem> {
    const body: any = {
      side: input.side,
      setId: input.setId || undefined,
      kind: input.kind,
      title: input.title || "",
      prompt: input.prompt,
      expiresAt: input.expiresAt ?? undefined,
    };

    const res = await fetchSameOrigin(`/api/rituals`, undefined, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await j<any>(res).catch(() => ({}));
    if (isRestrictedPayload(res, data)) throw new RestrictedError(res.status, "Restricted (login required).");
    if (!res.ok) throw new Error(String((data as any)?.error || `rituals:create failed (${res.status})`));

    const item = coerceRitual((data as any).ritual);
    if (!item) throw new Error("rituals:create invalid response");
    return item;
  },

  async ignite(id: string): Promise<RitualItem | null> {
    const safe = encodeURIComponent(id);
    const res = await fetchSameOrigin(`/api/rituals/${safe}/ignite`, undefined, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    const data = await j<any>(res).catch(() => ({}));
    if (isRestrictedPayload(res, data)) throw new RestrictedError(res.status, "Restricted (login required).");
    if (!res.ok) return null;
    return coerceRitual((data as any).ritual);
  },

  async respond(id: string, input: RespondInput): Promise<RitualItem | null> {
    const safe = encodeURIComponent(id);
    const body: any = {
      payload: input.payload && typeof input.payload === "object" ? input.payload : {},
      text: typeof input.text === "string" ? input.text : "",
    };
    const res = await fetchSameOrigin(`/api/rituals/${safe}/respond`, undefined, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await j<any>(res).catch(() => ({}));
    if (isRestrictedPayload(res, data)) throw new RestrictedError(res.status, "Restricted (login required).");
    if (!res.ok) throw new Error(String((data as any)?.error || `rituals:respond failed (${res.status})`));
    return coerceRitual((data as any).ritual);
  },

  async responses(id: string): Promise<RitualResponseItem[]> {
    const safe = encodeURIComponent(id);
    const res = await fetchSameOrigin(`/api/rituals/${safe}/responses`, undefined, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new RestrictedError(res.status, "Restricted (login required).");
    if (!res.ok) return [];
    const data = await j<ResponsesResp>(res).catch(() => ({} as any));
    if (isRestrictedPayload(res, data)) throw new RestrictedError(res.status, "Restricted (login required).");
    const items = Array.isArray((data as any).items) ? (data as any).items : [];
    return items.map(coerceResponse).filter(Boolean) as RitualResponseItem[];
  },
};
