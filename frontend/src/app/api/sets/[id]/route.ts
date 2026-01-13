import { NextResponse } from "next/server";
import { getSet, updateSet } from "@/src/lib/server/setsStore";
import { normalizeViewer, roleForViewer } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
// sd_viewer gating: resolveStubViewer reads cookie sd_viewer / header x-sd-viewer (never ?viewer=).

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);
  const role = roleForViewer(viewer);

  if (!r.viewerId || role !== "me") {
    return NextResponse.json({ ok: true, restricted: true, viewer: r.viewerId ? viewer : null, role, item: null });
  }

  const item = getSet(viewer, ctx.params.id);
  return NextResponse.json({ ok: true, restricted: false, viewer, role, item });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);
  const role = roleForViewer(viewer);

  if (!r.viewerId) {
    return NextResponse.json({ ok: false, restricted: true, error: "restricted" }, { status: 401 });
  }
  if (role !== "me") {
    return NextResponse.json({ ok: false, restricted: true, error: "restricted" }, { status: 403 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const patch: any = {};
  if (typeof body?.label === "string") patch.label = body.label;
  if (Array.isArray(body?.members)) patch.members = body.members.filter((m: any) => typeof m === "string");
  if (typeof body?.side === "string") patch.side = body.side;
  if (typeof body?.color === "string") patch.color = body.color;

  const item = updateSet(viewer, ctx.params.id, patch);
  if (!item) {
    return NextResponse.json({ ok: false, restricted: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, restricted: false, viewer, role, item });
}
