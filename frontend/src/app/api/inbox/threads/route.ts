import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/inboxViewer";
import { participantForThread } from "@/src/lib/server/inboxParticipant";
import { proxyJson } from "../../auth/_proxy";

function isGenericTitle(title: string): boolean {
  const t = String(title || "").trim();
  if (!t) return true;
  const low = t.toLowerCase();
  if (low === "thread" || low === "conversation") return true;
  if (low.startsWith("thread ")) return true;
  return false;
}

function _cleanSnippet(s: string): string {
  let t = String(s || "").replace(/\s+/g, " ").trim();
  // Remove common "You:" prefix from previews (keeps it readable).
  t = t.replace(/^you:\s+/i, "");
  return t;
}

function _truncate(s: string, n = 32): string {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  return t.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

// deriveThreadTitle: used for BOTH list + detail payloads.
function deriveThreadTitle(threadOrItem: any, messages?: any[]): string {
  try {
    const threadId = String((threadOrItem as any)?.id || "");
    const titleRaw = String((threadOrItem as any)?.title || "");
    if (!isGenericTitle(titleRaw)) return titleRaw;

    // 1) First message text (detail route)
    if (Array.isArray(messages) && messages.length) {
      const first = messages[0];
      const last = messages[messages.length - 1];
      const firstText = _cleanSnippet(String((first as any)?.text || ""));
      if (firstText) return _truncate(firstText);
      const lastText = _cleanSnippet(String((last as any)?.text || ""));
      if (lastText) return _truncate(lastText);
    }

    // 2) Last preview snippet (threads list route)
    const lastPreview = _cleanSnippet(String((threadOrItem as any)?.last || (threadOrItem as any)?.preview || ""));
    if (lastPreview) return _truncate(lastPreview);

    // 3) Thread id
    return _truncate(threadId || "Thread");
  } catch {
    return "Thread";
  }
}

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
            const titleRaw = String((it as any).title || "");
      const title = isGenericTitle(titleRaw) ? deriveThreadTitle(it) : titleRaw;
      return { ...(it as any), title, participant: participantForThread({ threadId, title }) };
    });
    return { ...(payload as any), items: patched };
  } catch {
    return payload;
  }
}

function sd_558b_json(payload: any, init?: any) {
  return (NextResponse as any).json(sd_558b_withParticipants(payload), init as any);
}


function parseLimit(raw: string | null): number | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const nn = Math.max(1, Math.min(50, Math.floor(n)));
  return nn;
}

function parseCursor(raw: string | null): string | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  if (t === "null" || t === "undefined") return null;

  // Cursor is opaque for clients, but current stub format is "<updatedAt>:<id>".
  // If it doesn't match, behave like no cursor (matches docs/INBOX_PAGINATION.md).
  if (!/^\d+:.+/.test(t)) return null;
  return t;
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

    const unread = Number((t as any)?.unread ?? 0);
  const updatedAtRaw =
    (t as any)?.updatedAt ??
    (t as any)?.updated_at ??
    (t as any)?.meta?.updatedAt ??
    (t as any)?.meta?.updated_at ??
    0;
  const updatedAt = Number(updatedAtRaw) || 0;

  return { ...t, unread, updatedAt, participant };
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
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = parseCursor(url.searchParams.get("cursor"));

  const isProd = process.env.NODE_ENV === "production";
  const { req2, viewerId } = withDevViewer(req);

  // Default-safe: in dev, if we don't know who the viewer is, return restricted.
  if (!isProd && !viewerId) {
    return sd_558b_json({ ok: true, restricted: true, items: [], hasMore: false, nextCursor: null }, { status: 200 });
  }

  const qs = new URLSearchParams();
  if (side) qs.set("side", side);
  if (limit) qs.set("limit", String(limit));
  if (cursor) qs.set("cursor", cursor);
  const path = qs.toString() ? `/api/inbox/threads?${qs.toString()}` : "/api/inbox/threads";

  const out = await proxyJson(req2, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;

  // sd_721_ensure_pagination_keys: some backends may omit pagination fields
  if (data && typeof data === "object") {
    if (!("hasMore" in data)) (data as any).hasMore = false;
    if (!("nextCursor" in data)) (data as any).nextCursor = null;
  }


  // Ensure deterministic participant fields for stable avatar variation.
  if (data && typeof data === "object" && Array.isArray((data as any).items)) {
    (data as any).items = (data as any).items.map((t: any) => fillParticipant(t));
  }

  const r = sd_558b_json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
