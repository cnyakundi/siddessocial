import { NextResponse } from "next/server";
import { listSetEvents } from "@/src/lib/server/setsStore";
import { normalizeViewer, roleForViewer } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
// sd_viewer gating: resolveStubViewer reads cookie sd_viewer / header x-sd-viewer (never ?viewer=).

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);
  const role = roleForViewer(viewer);

  if (!r.viewerId || role !== "me") {
    return NextResponse.json({ ok: true, restricted: true, viewer: r.viewerId ? viewer : null, role, items: [] });
  }

  const items = listSetEvents(viewer, ctx.params.id);
  return NextResponse.json({ ok: true, restricted: false, viewer, role, items });
}
