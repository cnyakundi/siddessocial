import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/inboxViewer";
import { participantForThread } from "@/src/lib/server/inboxParticipant";
import { proxyJson } from "../../../auth/_proxy";

// sd_558b_withThreadParticipant: inject participant fields for thread header
function sd_558b_withThreadParticipant(payload: any): any {
  try {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    const th = (payload as any).thread;
    if (!th || typeof th !== "object" || Array.isArray(th)) return payload;
    if ((th as any).participant) return payload;
    const threadId = String((th as any).id || "");
    const title = String((th as any).title || "");
    const participant = participantForThread({ threadId, title });
    return { ...(payload as any), thread: { ...(th as any), participant } };
  } catch {
    return payload;
  }
}

function sd_558b_json(payload: any, init?: any) {
  return (NextResponse as any).json(sd_558b_withThreadParticipant(payload), init as any);
}


function parseCursor(raw: string | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s === "null" || s === "undefined") return null;
  return s;
}

function withDevViewer(req: Request): { req2: Request; viewerId: string | null } {
  const isProd = process.env.NODE_ENV === "production";
  const r = resolveStubViewer(req);
  if (isProd || !r.viewerId) return { req2: req, viewerId: r.viewerId };
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return { req2: new Request(req.url, { method: req.method, headers: h }), viewerId: r.viewerId };
}

function restrictedThreadPayload() {
  return {
    ok: true,
    restricted: true,
    thread: null,
    meta: null,
    messages: [],
    messagesHasMore: false,
    messagesNextCursor: null,
  };
}

function restrictedSendPayload() {
  return { ok: true, restricted: true, message: null, meta: null };
}

function fillThreadParticipant(thread: any): any {
  if (!thread || typeof thread !== "object") return thread;
  const id = String((thread as any).id || "").trim();
  const title = String((thread as any).title || "").trim();
  if (!id) return thread;

  const existing = (thread as any).participant || null;
  const fallback = participantForThread({ threadId: id, title });

  const participant = {
    displayName: existing?.displayName ?? fallback.displayName,
    initials: existing?.initials ?? fallback.initials,
    avatarSeed: existing?.avatarSeed ?? fallback.avatarSeed,
    userId: existing?.userId ?? null,
    handle: existing?.handle ?? null,
  };

  return { ...(thread as any), participant };
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = String(ctx?.params?.id || "").trim();
  const url = new URL(req.url);
  const limit = String(url.searchParams.get("limit") || "").trim();
  const cursor = parseCursor(url.searchParams.get("cursor"));

  const isProd = process.env.NODE_ENV === "production";
  const { req2, viewerId } = withDevViewer(req);

  // Default-safe: in dev, missing viewer => restricted (no content).
  if (!isProd && !viewerId) {
    return sd_558b_json(restrictedThreadPayload(), { status: 200 });
  }

  const qs = new URLSearchParams();
  if (limit) qs.set("limit", limit);
  if (cursor) qs.set("cursor", cursor);
  const path = qs.toString()
    ? `/api/inbox/thread/${encodeURIComponent(id)}?${qs.toString()}`
    : `/api/inbox/thread/${encodeURIComponent(id)}`;

  const out = await proxyJson(req2, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  if (data && typeof data === "object" && (data as any).thread) {
    (data as any).thread = fillThreadParticipant((data as any).thread);
  }

  const r = sd_558b_json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const id = String(ctx?.params?.id || "").trim();
  const body = await req.json().catch(() => ({}));

  const isProd = process.env.NODE_ENV === "production";
  const { req2, viewerId } = withDevViewer(req);

  // Default-safe: in dev, missing viewer => restricted (no content).
  if (!isProd && !viewerId) {
    return sd_558b_json(restrictedSendPayload(), { status: 200 });
  }

  const path = `/api/inbox/thread/${encodeURIComponent(id)}`;
  const out = await proxyJson(req2, path, "POST", body || {});
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = sd_558b_json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
