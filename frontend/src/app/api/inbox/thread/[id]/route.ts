import { NextResponse } from "next/server";
import { participantForThread } from "@/src/lib/server/inboxParticipant";
import {
  appendMessage,
  clearThreadUnreadRole,
  ensureThread,
  getThread,
  listMessages,
  setThreadLockedSide,
} from "@/src/lib/server/inboxStore";
import { normalizeViewer, roleForViewer, viewerAllowed } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/inboxViewer";
// sd_viewer gating: resolveStubViewer reads cookie sd_viewer / header x-sd-viewer (never ?viewer=).


function parseCursor(raw: string | null): { ts: number; id: string } | null {
  if (!raw) return null;
  const m = raw.match(/^(\d+):(.+)$/);
  if (!m) return null;
  const ts = Number(m[1]);
  const id = String(m[2] || "");
  if (!Number.isFinite(ts) || !id) return null;
  return { ts, id };
}

function cursorFor(m: { ts: number; id: string }): string {
  return `${m.ts}:${m.id}`;
}

function isGenericTitle(title: string): boolean {
  const t = String(title || "").trim().toLowerCase();
  if (!t) return true;
  if (t === "thread" || t === "conversation") return true;
  if (t.startsWith("thread ")) return true;
  return false;
}

function normalizeSnippet(s: string): string {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function truncateSnippet(s: string, maxLen = 28): string {
  const v = normalizeSnippet(s);
  if (v.length <= maxLen) return v;
  return v.slice(0, Math.max(0, maxLen - 1)) + "…";
}

function deriveThreadTitle(args: { title: string; threadId: string; msgs: Array<{ text?: string }>; lastText?: string }): string {
  const title = String(args.title || "").trim();
  if (!isGenericTitle(title)) return title;

  const firstText = args.msgs && args.msgs.length ? String(args.msgs[0]?.text || "") : "";
  const lastText = String(args.lastText || "");
  const src = normalizeSnippet(firstText) || normalizeSnippet(lastText);
  if (src) return truncateSnippet(src, 32);

  return String(args.threadId || "thread");
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const { viewerId } = resolveStubViewer(req);

  // Default-safe: unknown viewer means no thread data leaks.
  if (!viewerId) {
    return NextResponse.json({
      ok: true,
      restricted: true,
      viewer: null,
      role: "anon",
      thread: null,
      meta: null,
      messages: [],
      messagesHasMore: false,
      messagesNextCursor: null,
    });
  }

  const viewer = normalizeViewer(viewerId);
  const role = roleForViewer(viewer);

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  let limit = limitRaw ? Number(limitRaw) : 30;
  if (!Number.isFinite(limit) || limit <= 0) limit = 30;
  limit = Math.min(100, Math.floor(limit));

  const cursor = parseCursor(url.searchParams.get("cursor"));

  const thread = getThread(id) || ensureThread(id, { title: "Thread", lockedSide: "friends" });

  const participant = participantForThread({ threadId: String(thread.id), title: String(thread.title) });

  if (!viewerAllowed(viewer, thread.lockedSide)) {
    return NextResponse.json({
      ok: true,
      restricted: true,
      viewer,
      role,
      thread: null,
      meta: null,
      messages: [],
      messagesHasMore: false,
      messagesNextCursor: null,
    });
  }

  // Mark read for this viewer role on any successful GET.
  clearThreadUnreadRole(id, role as any);

  const all = listMessages(id); // sorted asc
  const last = all.length ? all[all.length - 1] : null;

  let eligible = all;
  if (cursor) {
    eligible = all.filter((m) => {
      if (m.ts < cursor.ts) return true;
      if (m.ts > cursor.ts) return false;
      return String(m.id) < cursor.id;
    });
  }

  const hasMore = eligible.length > limit;
  const page = eligible.length > limit ? eligible.slice(eligible.length - limit) : eligible;
  const nextCursor = hasMore ? cursorFor({ ts: page[0].ts, id: page[0].id }) : null;

  return NextResponse.json({
    ok: true,
    restricted: false,
    viewer,
    role,
    thread: {
      id: thread.id,
      title: deriveThreadTitle({ title: String(thread.title), threadId: String(thread.id), msgs: all as any, lastText: last?.text || "" }),
      participant,
      lockedSide: thread.lockedSide,
      last: last?.text || "",
      time: "",
      unread: 0,
    },
    meta: {
      lockedSide: thread.lockedSide,
      updatedAt: thread.updatedAt,
    },
    messages: page.map((m) => ({
      id: m.id,
      ts: m.ts,
      from: m.from,
      text: m.text,
      side: m.side,
      queued: false,
    })),
    messagesHasMore: hasMore,
    messagesNextCursor: nextCursor,
  });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const { viewerId } = resolveStubViewer(req);

  // Default-safe: unknown viewer means no message mutation.
  if (!viewerId) {
    return NextResponse.json({
      ok: true,
      restricted: true,
      viewer: null,
      role: "anon",
      meta: null,
      message: null,
    });
  }

  const viewer = normalizeViewer(viewerId);
  const role = roleForViewer(viewer);

  const thread = getThread(id) || ensureThread(id, { title: "Thread", lockedSide: "friends" });

  const participant = participantForThread({ threadId: String(thread.id), title: String(thread.title) });

  if (!viewerAllowed(viewer, thread.lockedSide)) {
    return NextResponse.json({
      ok: true,
      restricted: true,
      viewer,
      role,
      meta: null,
      message: null,
    });
  }

  const body = await req.json().catch(() => ({} as any));

  if (body?.setLockedSide) {
    const nextSide = String(body.setLockedSide);

    if (!viewerAllowed(viewer, nextSide)) {
      return NextResponse.json({
        ok: true,
        restricted: true,
        viewer,
        role,
        meta: null,
      });
    }

    const updated = setThreadLockedSide(id, nextSide as any);

    // Moving the thread implies the caller just interacted with it; mark read for caller role.
    clearThreadUnreadRole(id, role as any);

    return NextResponse.json({
      ok: true,
      restricted: false,
      viewer,
      role,
      meta: { lockedSide: updated.lockedSide, updatedAt: updated.updatedAt },
    });
  }

  const text = String(body?.text || "").trim();
  const from = (String(body?.from || "me") as any) === "them" ? "them" : "me";
  if (!text) {
    return NextResponse.json({ ok: false, error: "missing_text" }, { status: 400 });
  }

  const msg = appendMessage(id, { from, text, side: thread.lockedSide, viewerRole: role as any });

  return NextResponse.json({
    ok: true,
    restricted: false,
    viewer,
    role,
    message: {
      id: msg.id,
      ts: msg.ts,
      from: msg.from,
      text: msg.text,
      side: msg.side,
      queued: false,
    },
    meta: { lockedSide: thread.lockedSide, updatedAt: msg.ts },
  });
}
