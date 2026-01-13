import { NextResponse } from "next/server";
import { participantForThread } from "@/src/lib/server/inboxParticipant";
import { listMessages, listThreads, getThreadUnread } from "@/src/lib/server/inboxStore";
import { normalizeViewer, roleForViewer, viewerAllowed } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/inboxViewer";
// sd_viewer gating: resolveStubViewer reads cookie sd_viewer / header x-sd-viewer (never ?viewer=).

function ageLabel(ts: number): string {
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff) || diff < 0) return "now";
  if (diff < 60_000) return "now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const w = Math.floor(days / 7);
  return `${w}w`;
}

function parseCursor(raw: string | null): { updatedAt: number; id: string } | null {
  if (!raw) return null;
  const m = raw.match(/^(\d+):(.+)$/);
  if (!m) return null;
  const updatedAt = Number(m[1]);
  const id = String(m[2] || "");
  if (!Number.isFinite(updatedAt) || !id) return null;
  return { updatedAt, id };
}

function cursorFor(t: { updatedAt: number; id: string }): string {
  return `${t.updatedAt}:${t.id}`;
}

// Legacy deterministic hint (only if server counter doesn't exist)
function hashSeed(s: string): number {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x + s.charCodeAt(i)) % 97;
  return x;
}

function unreadHint(args: {
  role: string;
  threadId: string;
  lockedSide: string;
  lastFrom: string | null;
}): number {
  if (args.role === "anon") return 0;
  if (!args.lastFrom || args.lastFrom !== "them") return 0;

  const seed = hashSeed(`${args.role}|${args.threadId}|${args.lockedSide}`);
  let n = 1 + (seed % 2);

  if (args.role === "me") n += 1;
  if (args.role === "close" && args.lockedSide === "close") n += 1;
  if (args.role === "work" && args.lockedSide === "work") n += 1;
  if (args.role === "friends" && args.lockedSide === "friends") n += 1;

  return Math.min(5, Math.max(0, n));
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

function deriveThreadTitle(args: {
  title: string;
  threadId: string;
  msgs: Array<{ text?: string }>;
  lastText?: string;
}): string {
  const title = String(args.title || "").trim();
  if (!isGenericTitle(title)) return title;

  const firstText = args.msgs && args.msgs.length ? String(args.msgs[0]?.text || "") : "";
  const lastText = String(args.lastText || "");
  const src = normalizeSnippet(firstText) || normalizeSnippet(lastText);
  if (src) return truncateSnippet(src, 32);

  return String(args.threadId || "thread");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const side = url.searchParams.get("side"); // optional

  const { viewerId } = resolveStubViewer(req);

  // Default-safe: if viewer is unknown, do not leak even public threads.
  if (!viewerId) {
    return NextResponse.json({
      ok: true,
      restricted: true,
      viewer: null,
      role: "anon",
      side: side || null,
      count: 0,
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  }

  const viewer = normalizeViewer(viewerId);
  const role = roleForViewer(viewer);

  const limitRaw = url.searchParams.get("limit");
  let limit = limitRaw ? Number(limitRaw) : 20;
  if (!Number.isFinite(limit) || limit <= 0) limit = 20;
  limit = Math.min(50, Math.floor(limit));

  const cursor = parseCursor(url.searchParams.get("cursor"));

  if (side && !viewerAllowed(viewer, side)) {
    return NextResponse.json({
      ok: true,
      restricted: true,
      viewer,
      role,
      side,
      count: 0,
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  }

  const all = listThreads();
  let allowed = side
    ? all.filter((t) => String(t.lockedSide) === String(side))
    : all.filter((t) => viewerAllowed(viewer, t.lockedSide));

  if (cursor) {
    allowed = allowed.filter((t) => {
      const updatedAt = Number(t.updatedAt);
      const id = String(t.id);
      if (updatedAt < cursor.updatedAt) return true;
      if (updatedAt > cursor.updatedAt) return false;
      return id < cursor.id;
    });
  }

  const slice = allowed.slice(0, limit + 1);
  const hasMore = slice.length > limit;
  const page = hasMore ? slice.slice(0, limit) : slice;

  const items = page.map((t) => {
    const msgs = listMessages(t.id);
    const last = msgs.length ? msgs[msgs.length - 1] : null;

    const stored = getThreadUnread(String(t.id), role as any);
    const unread =
      stored === null
        ? unreadHint({
            role,
            threadId: String(t.id),
            lockedSide: String(t.lockedSide),
            lastFrom: last ? String((last as any).from) : null,
          })
        : stored;

    const updatedAt = Number(t.updatedAt);

    const derivedTitle = deriveThreadTitle({
      title: String((t as any).title || ""),
      threadId: String(t.id),
      msgs,
      lastText: last?.text || "",
    });

    const participant = participantForThread({ threadId: String(t.id), title: derivedTitle });
    return {
      id: t.id,
      title: derivedTitle,
      participant,
      lockedSide: t.lockedSide,
      last: last?.text || "",
      time: last ? ageLabel(last.ts) : ageLabel(updatedAt),
      unread,
      updatedAt,
    };
  });

  const nextCursor = hasMore ? cursorFor(page[page.length - 1]) : null;

  return NextResponse.json({
    ok: true,
    restricted: false,
    viewer,
    role,
    side: side || null,
    count: items.length,
    items,
    hasMore,
    nextCursor,
  });
}
