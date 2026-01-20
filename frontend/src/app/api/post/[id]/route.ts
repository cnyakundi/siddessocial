import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "../../auth/_proxy";
// NOTE: Dev stub viewer cookie is named sd_viewer (set by StubViewerCookie).
// resolveStubViewer reads sd_viewer in dev; prod ignores it.

function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

// GET /api/post/:id -> Django GET /api/post/:id
export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const url = new URL(req.url);
  const qs = url.search || "";

  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, `/api/post/${id}${qs}`, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// PATCH /api/post/:id -> Django PATCH /api/post/:id
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));
  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, `/api/post/${encodeURIComponent(String(id || "").trim())}`, "PATCH", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// DELETE /api/post/:id -> Django DELETE /api/post/:id
export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, `/api/post/${encodeURIComponent(String(id || "").trim())}`, "DELETE");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
