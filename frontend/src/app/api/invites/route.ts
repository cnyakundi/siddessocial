import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "../auth/_proxy";


function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

// GET /api/invites -> Django GET /api/invites
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.search || "";
  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, "/api/invites" + qs, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;

  // sd_789_invites_softfail_404: dev gate resilience.
  // If the backend Invites router is temporarily disabled/missing in a given dev env,
  // return a default-safe restricted payload (HTTP 200) instead of propagating 404.
  if (res.status === 404) {
    return NextResponse.json({ ok: true, restricted: true, viewer: null, role: "anon", items: [] }, { status: 200 });
  }
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// POST /api/invites -> Django POST /api/invites
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/invites", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
