import { NextResponse } from "next/server";
import { findPostById } from "@/src/lib/postLookup";
import { getPost } from "@/src/lib/server/postsStore";
import { normalizeViewer, viewerAllowed } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
// sd_viewer gating: resolveStubViewer reads cookie sd_viewer / header x-sd-viewer (never ?viewer=).

function normalizeApiBase(raw: string | undefined | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.origin;
  } catch {
    return null;
  }
}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; data: any | null } | null> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch {
    return null;
  }
}


export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);

  const id = params?.id;
  if (!id) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });


const base = normalizeApiBase((process.env.SD_INTERNAL_API_BASE || process.env.NEXT_PUBLIC_API_BASE));
if (base && r.viewerId) {
  const url = new URL(`/api/post/${encodeURIComponent(id)}`, base).toString();
  const prox = await fetchJson(url, { method: "GET", headers: { "x-sd-viewer": r.viewerId } });

  if (prox && prox.status < 500) {
    if (prox.status !== 404) {
      return NextResponse.json(prox.data ?? { ok: false, error: "bad_gateway" }, { status: prox.status });
    }
    // 404 -> fall through to local stubs (IDs may differ)
  }
}

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
