import { NextResponse } from "next/server";
import { findPostById } from "@/src/lib/postLookup";
import { getPost } from "@/src/lib/server/postsStore";
import { normalizeViewer, viewerAllowed } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
// sd_viewer gating: resolveStubViewer reads cookie sd_viewer / header x-sd-viewer (never ?viewer=).

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);

  const id = params?.id;
  if (!id) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // 1) Try mock library (static)
  const found = findPostById(id);
  if (found) {
    if (!r.viewerId || !viewerAllowed(viewer, found.side)) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...found });
  }

  // 2) Try stored posts
  const p = getPost(id);
  if (p) {
    if (!r.viewerId || !viewerAllowed(viewer, p.side)) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, post: p, side: p.side });
  }

  return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
}
