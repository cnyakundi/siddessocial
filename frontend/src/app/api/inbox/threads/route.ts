import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/inboxViewer";
import { participantForThread } from "@/src/lib/server/inboxParticipant";
import { proxyJson } from "../../auth/_proxy";

// sd_558b_withParticipants: inject participant fields for UI avatar seeds
function sd_558b_withParticipants(payload: any): any {
  try {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    const items = (payload as any).items;
    if (!Array.isArray(items)) return payload;
    const patched = items.map((it: any) => {
      if (!it || typeof it !== "object" || Array.isArray(it)) return it;
      if ((it as any).participant) return it;
      const threadId = String((it as any).id || "");
      const title = String((it as any).title || "");
      return { ...(it as any), participant: participantForThread({ threadId, title }) };
    });
    return { ...(payload as any), items: patched };
  } catch {
    return payload;
  }
}

function sd_558b_json(payload: any, init?: any) {
  return (NextResponse as any).json(sd_558b_withParticipants(payload), init as any);
}


function withDevViewer(req: Request): { req2: Request; viewerId: string | null } {
  const isProd = process.env.NODE_ENV === "production";
  const r = resolveStubViewer(req);
  if (isProd || !r.viewerId) return { req2: req, viewerId: r.viewerId };
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return { req2: new Request(req.url, { method: req.method, headers: h }), viewerId: r.viewerId };
}

function fillParticipant(t: any): any {
  const id = String(t?.id || "").trim();
  const title = String(t?.title || "").trim();
  if (!id) return t;

  const existing = (t && typeof t === "object" ? t.participant : null) || null;
  const fallback = participantForThread({ threadId: id, title });

  const participant = {
    displayName: existing?.displayName ?? fallback.displayName,
    initials: existing?.initials ?? fallback.initials,
    avatarSeed: existing?.avatarSeed ?? fallback.avatarSeed,
    userId: existing?.userId ?? null,
    handle: existing?.handle ?? null,
  };

  return { ...t, participant };
}

/**
 * Next stub route: /api/inbox/threads
 *
 * Rules:
 * - Default-safe: missing viewer (dev) => restricted=true with no content.
 * - Never accept viewer identity via URL query params.
 * - Dev-only: forward stub viewer via x-sd-viewer (cookie/header).
 * - Always forward the session cookie.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const side = String(url.searchParams.get("side") || "").trim();
  const limit = String(url.searchParams.get("limit") || "").trim();
  const cursor = String(url.searchParams.get("cursor") || "").trim();

  const isProd = process.env.NODE_ENV === "production";
  const { req2, viewerId } = withDevViewer(req);

  // Default-safe: in dev, if we don't know who the viewer is, return restricted.
  if (!isProd && !viewerId) {
    return sd_558b_json({ ok: true, restricted: true, items: [], hasMore: false, nextCursor: null }, { status: 200 });
  }

  const qs = new URLSearchParams();
  if (side) qs.set("side", side);
  if (limit) qs.set("limit", limit);
  if (cursor) qs.set("cursor", cursor);
  const path = qs.toString() ? `/api/inbox/threads?${qs.toString()}` : "/api/inbox/threads";

  const out = await proxyJson(req2, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;

  // Ensure deterministic participant fields for stable avatar variation.
  if (data && typeof data === "object" && Array.isArray((data as any).items)) {
    (data as any).items = (data as any).items.map((t: any) => fillParticipant(t));
  }

  const r = sd_558b_json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
