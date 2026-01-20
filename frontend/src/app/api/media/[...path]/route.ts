import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "../../auth/_proxy";

function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

function joinPath(parts: string[] | undefined): string {
  const p = Array.isArray(parts) ? parts : [];
  return p
    .map((s) => String(s || "").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) {
  const sub = joinPath(ctx?.params?.path);
  const url = new URL(req.url);
  const qs = url.search || "";

  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, `/api/media/${sub}${qs}`, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

export async function POST(req: Request, ctx: { params: { path: string[] } }) {
  const sub = joinPath(ctx?.params?.path);
  const body = await req.json().catch(() => ({}));

  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, `/api/media/${sub}`, "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
