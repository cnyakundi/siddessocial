import { NextResponse } from "next/server";
import { MOCK_POSTS } from "@/src/lib/mockFeed";
import { listPostsBySide } from "@/src/lib/server/postsStore";
import { normalizeViewer, viewerAllowed } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
// sd_viewer gating: resolveStubViewer reads cookie sd_viewer / header x-sd-viewer (never ?viewer=).

export async function GET(req: Request) {
  const url = new URL(req.url);
  const side = (url.searchParams.get("side") || "public").toLowerCase();

  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);

  // Default-safe: unknown viewer => no private data.
  if (!r.viewerId) {
    return NextResponse.json({ ok: true, restricted: true, viewer, side, count: 0, items: [] });
  }

  // Default-safe: viewer not allowed for side => empty result.
  if (!viewerAllowed(viewer, side)) {
    return NextResponse.json({ ok: true, restricted: true, viewer, side, count: 0, items: [] });
  }

  // Stored posts + mock posts merged (dev/demo)
  const stored = listPostsBySide(side as any);
  const mocked = (MOCK_POSTS as any)[side] || [];
  const items = [...stored, ...mocked];

  return NextResponse.json({
    ok: true,
    restricted: false,
    viewer,
    side,
    count: items.length,
    items,
  });
}
