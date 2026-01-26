import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { resolveBestInternalBase } from "../auth/_proxy";
// NOTE: Dev stub viewer cookie is named sd_viewer (set by StubViewerCookie).
// resolveStubViewer reads sd_viewer in dev; prod ignores it.

// Strict backend proxy for /api/feed.
// - No frontend mock feed fallback.
// - Always forwards the session cookie.
// - Dev-only: optionally forwards x-sd-viewer (never required).
// - Dev-only: auto-detects the correct backend origin via /healthz on ports 8000..8010.

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; data: any } | null> {
  try {
    const res = await fetch(url, init);
    const status = res.status;
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status, data };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const side = (url.searchParams.get("side") || "public").toLowerCase();
  const isProd = process.env.NODE_ENV === "production";

  const base = await resolveBestInternalBase();
  if (!base) {
    return NextResponse.json(
      isProd
        ? { ok: false, error: "backend_not_configured" }
        : {
            ok: false,
            error: "backend_not_configured",
            hint: "Set SD_INTERNAL_API_BASE (or NEXT_PUBLIC_API_BASE) to your Django origin, e.g. http://127.0.0.1:8001",
          },
      { status: 500 }
    );
  }

  const proxUrl = new URL("/api/feed", base);
  proxUrl.searchParams.set("side", side);

  const topic = (url.searchParams.get("topic") || "").trim();
  if (topic) proxUrl.searchParams.set("topic", topic);

  const tag = (url.searchParams.get("tag") || "").trim();
  if (tag) proxUrl.searchParams.set("tag", tag);

  const set = (url.searchParams.get("set") || "").trim();
  if (set) proxUrl.searchParams.set("set", set);

  const limit = (url.searchParams.get("limit") || "").trim();
  if (limit) proxUrl.searchParams.set("limit", limit);

  const cursor = (url.searchParams.get("cursor") || "").trim();
  if (cursor) proxUrl.searchParams.set("cursor", cursor);

  // Always forward cookie for session auth (required).
  const headers: Record<string, string> = {
    cookie: req.headers.get("cookie") || "",
  };

  // Dev-only header (optional).
  if (!isProd) {
    const r = resolveStubViewer(req);
    if (r.viewerId) headers["x-sd-viewer"] = r.viewerId;
  }

  const prox = await fetchJson(proxUrl.toString(), { method: "GET", headers, cache: "no-store" });

  if (!prox) {
    return NextResponse.json(
      isProd
        ? { ok: false, error: "bad_gateway" }
        : { ok: false, error: "bad_gateway", hint: "Django /api/feed is unreachable (check docker backend port)" },
      { status: 502 }
    );
  }

  const out = NextResponse.json(prox.data ?? { ok: false, error: "bad_gateway" }, { status: prox.status });
  if (!isProd) out.headers.set("x-sd-proxy-origin", base);
  return out;
}
