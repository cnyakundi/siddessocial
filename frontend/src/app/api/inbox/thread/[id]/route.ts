import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/inboxViewer";
import { participantForThread } from "@/src/lib/server/inboxParticipant";
import { clearThreadUnreadRole } from "@/src/lib/server/inboxStore";
import { viewerAllowed, roleForViewer } from "@/src/lib/server/inboxVisibility";
import { proxyJson } from "../../../auth/_proxy";

function _cleanSnippet(s: string): string {
  let t = String(s || "").replace(/\s+/g, " ").trim();
  t = t.replace(/^you:\s+/i, "");
  return t;
}

function _truncate(s: string, n = 32): string {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  return t.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

function _isGenericTitle(title: string): boolean {
  const t = String(title || "").trim();
  if (!t) return true;
  const low = t.toLowerCase();
  if (low === "thread" || low === "conversation") return true;
  if (low.startsWith("thread ")) return true;
  return false;
}

function deriveThreadTitle(threadOrItem: any, messages?: any[]): string {
  try {
    const threadId = String((threadOrItem as any)?.id || "");
    const titleRaw = String((threadOrItem as any)?.title || "");
    if (!_isGenericTitle(titleRaw)) return titleRaw;

    if (Array.isArray(messages) && messages.length) {
      const first = messages[0];
      const last = messages[messages.length - 1];
      const firstText = _cleanSnippet(String((first as any)?.text || ""));
      if (firstText) return _truncate(firstText);
      const lastText = _cleanSnippet(String((last as any)?.text || ""));
      if (lastText) return _truncate(lastText);
    }

    const lastPreview = _cleanSnippet(String((threadOrItem as any)?.last || ""));
    if (lastPreview) return _truncate(lastPreview);

    return _truncate(threadId || "Thread");
  } catch {
    return "Thread";
  }
}

// sd_558b_withThreadParticipant: inject participant fields for thread header
function sd_558b_withThreadParticipant(payload: any): any {
  try {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    const th = (payload as any).thread;
    const msgs = (payload as any).messages;
    if (!th || typeof th !== "object" || Array.isArray(th)) return payload;
    if ((th as any).participant) return payload;
    const threadId = String((th as any).id || "");
        const title = deriveThreadTitle(th, Array.isArray(msgs) ? msgs : undefined);
    const participant = participantForThread({ threadId, title });
    return { ...(payload as any), thread: { ...(th as any), title, participant } };
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

  // In both dev + prod, rely on the backend for auth/restriction.
  // viewerId is only used for dev-only shims.

  // sd_743_inbox_proxy_gate: stub unread clearing only when we have a stub viewer (dev).
  if (!isProd && viewerId) {
    const viewerRole = roleForViewer(viewerId);
    clearThreadUnreadRole(id, viewerRole);
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

  // sd_743_inbox_proxy_gate: stub visibility shim only when we have a stub viewer (dev).
  if (!isProd && viewerId) {
    try {
      const v = viewerId;
      const th = data && typeof data === "object" ? (data as any).thread : null;
      const meta = data && typeof data === "object" ? (data as any).meta : null;
      const lockedSide = String((meta as any)?.locked_side || (th as any)?.lockedSide || (th as any)?.locked_side || "public");
      if (lockedSide && !viewerAllowed(v, lockedSide)) {
        return sd_558b_json(restrictedThreadPayload(), { status: 200 });
      }
    } catch {
      // ignore
    }
  }

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

  // In both dev + prod, rely on the backend for auth/restriction.
  // viewerId is only used for dev-only shims.

  const path = `/api/inbox/thread/${encodeURIComponent(id)}`;
  const out = await proxyJson(req2, path, "POST", body || {});
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = sd_558b_json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
