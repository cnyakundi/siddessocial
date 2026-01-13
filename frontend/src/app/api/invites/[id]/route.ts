import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { normalizeViewer, roleForViewer } from "@/src/lib/server/inboxVisibility";
import { actInvite, getInvite } from "@/src/lib/server/invitesStore";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);
  const role = roleForViewer(viewer);

  if (!r.viewerId) {
    return NextResponse.json({ ok: true, restricted: true, viewer: null, role: "anon", item: null });
  }

  const id = decodeURIComponent(params.id || "");
  const item = getInvite(viewer, id);
  return NextResponse.json({ ok: true, restricted: false, viewer, role, item });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);
  const role = roleForViewer(viewer);

  if (!r.viewerId) {
    return NextResponse.json({ ok: false, restricted: true, error: "restricted" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const action = String(body?.action || "").trim().toLowerCase();
  if (action !== "accept" && action !== "reject" && action !== "revoke") {
    return NextResponse.json({ ok: false, restricted: false, error: "bad_request" }, { status: 400 });
  }

  const id = decodeURIComponent(params.id || "");
  const item = actInvite(viewer, id, action as any);
  if (!item) {
    return NextResponse.json({ ok: false, restricted: false, error: "not_found" }, { status: 404 });
  }

  // keep parity with other routes by returning viewer role, but we don't use it for gating here.
  return NextResponse.json({ ok: true, restricted: false, viewer, role, item });
}
