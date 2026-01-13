import { NextResponse } from "next/server";
import type { SideId } from "@/src/lib/sides";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { normalizeViewer, roleForViewer } from "@/src/lib/server/inboxVisibility";
import { createInvite, listInvites, type InviteDirection } from "@/src/lib/server/invitesStore";

function parseSide(raw: any): SideId {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "public" || v === "friends" || v === "close" || v === "work") return v;
  return "friends";
}

function parseDirection(raw: string | null): InviteDirection {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "incoming" || v === "outgoing") return v;
  return "all";
}

export async function GET(req: Request) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);
  const role = roleForViewer(viewer);

  if (!r.viewerId) {
    return NextResponse.json({ ok: true, restricted: true, viewer: null, role: "anon", items: [] });
  }

  const url = new URL(req.url);
  const direction = parseDirection(url.searchParams.get("direction"));
  const items = listInvites(viewer, direction);
  return NextResponse.json({ ok: true, restricted: false, viewer, role, items });
}

export async function POST(req: Request) {
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

  const setId = typeof body?.setId === "string" ? body.setId : "";
  const to = typeof body?.to === "string" ? body.to : "";
  const side = parseSide(body?.side);
  const message = typeof body?.message === "string" ? body.message : "";

  if (!setId || !to) {
    return NextResponse.json({ ok: false, restricted: false, error: "bad_request" }, { status: 400 });
  }

  const item = createInvite(viewer, { setId, side, to, message });
  return NextResponse.json({ ok: true, restricted: false, viewer, role, item });
}
