import { NextResponse } from "next/server";
import { upsertPost } from "@/src/lib/server/postsStore";
import { normalizePublicChannel } from "@/src/lib/publicChannels";
import { normalizeViewer, roleForViewer } from "@/src/lib/server/inboxVisibility";
import { enforcePublicWriteGates, publicTrustGatesEnabled } from "@/src/lib/server/publicTrustGates";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { resolveStubTrust } from "@/src/lib/server/stubTrust";
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


export async function POST(req: Request) {
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);

  // Default-safe: no viewer => reject writes.
  if (!r.viewerId) {
    return NextResponse.json({ ok: false, restricted: true, error: "restricted" }, { status: 401 });
  }

  // For now, only allow "me" to create posts in stub mode.
  if (roleForViewer(viewer) !== "me") {
    return NextResponse.json({ ok: false, restricted: true, error: "restricted" }, { status: 403 });
  }

  try {
    const body = await req.json();


const base = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE);
if (base) {
  const trust = resolveStubTrust(req, r.viewerId).trustLevel;
  const url = new URL("/api/post", base).toString();
  const prox = await fetchJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sd-viewer": r.viewerId,
      ...(trust !== null ? { "x-sd-trust": String(trust) } : {}),
    },
    body: JSON.stringify(body),
  });

  if (prox && prox.status < 500) {
    return NextResponse.json(prox.data ?? { ok: false, error: "bad_gateway" }, { status: prox.status });
  }
}
    const side = (body?.side || "public").toString() as any;
    const text = (body?.text || "").toString().trim();
    const setId = body?.setId ? String(body.setId) : null;
    const urgent = Boolean(body?.urgent);
    const clientKey = body?.client_key ? String(body.client_key) : null;
    const publicChannel = body?.publicChannel ? normalizePublicChannel(body.publicChannel) : null;

    if (!text) return NextResponse.json({ ok: false, error: "empty_text" }, { status: 400 });

    // Public trust gates (optional, behind flag)
    const trust = resolveStubTrust(req, r.viewerId).trustLevel;
    if (publicTrustGatesEnabled() && side === "public") {
      const gate = enforcePublicWriteGates({ viewerId: r.viewerId, trustLevel: trust, text, kind: "post" });
      if (!gate.ok) {
        return NextResponse.json(
          { ok: false, restricted: gate.status === 401, error: gate.error, retry_after_ms: gate.retryAfterMs, min_trust: gate.minTrust },
          { status: gate.status }
        );
      }
    }

    const post = upsertPost({
      side,
      text,
      setId,
      urgent,
      clientKey,
      publicChannel: side === "public" ? publicChannel : null,
      trustLevel: side === "public" ? trust : 3,
    });

    return NextResponse.json({ ok: true, status: 201, post }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
}
