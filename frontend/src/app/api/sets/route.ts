import { NextResponse } from "next/server";
import type { SideId } from "@/src/lib/sides";
import { listSets, createSet, bulkCreateSets } from "@/src/lib/server/setsStore";
import { normalizeViewer, roleForViewer } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
// sd_viewer gating: resolveStubViewer reads cookie sd_viewer / header x-sd-viewer (never ?viewer=).

function parseSide(raw: string | null): SideId | null {
  const v = (raw || "").trim();
  if (v === "public" || v === "friends" || v === "close" || v === "work") return v;
  return null;
}

export async function GET(req: Request) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);
  const role = roleForViewer(viewer);

  // Default-safe: unknown viewer => restricted, empty.
  if (!r.viewerId || role !== "me") {
    return NextResponse.json({ ok: true, restricted: true, viewer: r.viewerId ? viewer : null, role, items: [] });
  }

  const url = new URL(req.url);
  const side = parseSide(url.searchParams.get("side"));

  const items = listSets(viewer, side ? { side } : undefined);
  return NextResponse.json({ ok: true, restricted: false, viewer, role, items });
}

export async function POST(req: Request) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);
  const role = roleForViewer(viewer);

  // Default-safe: no viewer => reject writes.
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

  // Bulk create
  if (body && Array.isArray(body.inputs)) {
    const inputs = body.inputs
      .filter(Boolean)
      .map((x: any) => ({
        side: (parseSide(x.side) || "friends") as SideId,
        label: typeof x.label === "string" ? x.label : "Untitled",
        members: Array.isArray(x.members) ? x.members.filter((m: any) => typeof m === "string") : [],
        color: typeof x.color === "string" ? x.color : undefined,
      }));

    const items = bulkCreateSets(viewer, inputs);
    return NextResponse.json({ ok: true, restricted: false, viewer, role, items });
  }

  const side = (parseSide(body?.side) || "friends") as SideId;
  const label = typeof body?.label === "string" ? body.label : "Untitled";
  const members = Array.isArray(body?.members) ? body.members.filter((m: any) => typeof m === "string") : [];
  const color = typeof body?.color === "string" ? body.color : undefined;

  const item = createSet(viewer, { side, label, members, color });
  return NextResponse.json({ ok: true, restricted: false, viewer, role, item });
}
