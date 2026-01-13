import { NextResponse } from "next/server";
import { addReply } from "@/src/lib/server/repliesStore";
import { findPostById } from "@/src/lib/postLookup";
import { getPost } from "@/src/lib/server/postsStore";
import { enforcePublicWriteGates, publicTrustGatesEnabled } from "@/src/lib/server/publicTrustGates";
import { normalizeViewer, roleForViewer, viewerAllowed } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";

// sd_viewer gating: resolveStubViewer reads cookie sd_viewer / header x-sd-viewer (never ?viewer=).
import { resolveStubTrust } from "@/src/lib/server/stubTrust";

function resolveSide(postId: string): string | null {
  const found = findPostById(postId);
  if (found) return found.side;

  const stored = getPost(postId);
  if (stored) return stored.side;

  return null;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params?.id || "";
  const r = resolveStubViewer(req);
  const viewer = normalizeViewer(r.viewerId);

  try {
    const body = await req.json();
    const text = (body?.text || "").toString().trim();
    const clientKey = body?.client_key ? String(body.client_key) : null;

    if (!id) return NextResponse.json({ ok: false, error: "missing_post_id" }, { status: 400 });
    if (!text) return NextResponse.json({ ok: false, error: "empty_text" }, { status: 400 });

    const side = resolveSide(id);
    if (!side) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    // Stub visibility gate: hide existence by returning 404
    if (!r.viewerId || !viewerAllowed(viewer, side)) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // Writes to private sides are still restricted to "me" in stub mode.
    if (side !== "public" && roleForViewer(viewer) !== "me") {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // Public trust gates (optional, behind flag)
    const trust = resolveStubTrust(req, r.viewerId).trustLevel;
    if (publicTrustGatesEnabled() && side === "public") {
      const gate = enforcePublicWriteGates({ viewerId: r.viewerId, trustLevel: trust, text, kind: "reply" });
      if (!gate.ok) {
        return NextResponse.json(
          { ok: false, restricted: gate.status === 401, error: gate.error, retry_after_ms: gate.retryAfterMs, min_trust: gate.minTrust },
          { status: gate.status }
        );
      }
    }

    const reply = {
      id: `r_${Date.now().toString(36)}`,
      postId: id,
      text,
      createdAt: Date.now(),
      clientKey,
    };

    addReply(reply);

    return NextResponse.json(
      {
        ok: true,
        status: 201,
        reply: {
          id: reply.id,
          post_id: id,
          text,
          client_key: clientKey,
          created_at: reply.createdAt,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
}
