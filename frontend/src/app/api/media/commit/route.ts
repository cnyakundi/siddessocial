import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "@/src/app/api/auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const req2 = withDevViewer(req);

  const out = await proxyJson(req2, "/api/media/commit", "POST", body);

  if (out instanceof NextResponse) {
    out.headers.set("cache-control", "no-store");
    return out;
  }

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  r.headers.set("cache-control", "no-store");
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
