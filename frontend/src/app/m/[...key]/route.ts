import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "@/src/app/api/auth/_proxy";

export const dynamic = "force-dynamic";

function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

export async function GET(req: Request, ctx: { params: { key: string[] } }) {
  const parts = Array.isArray(ctx?.params?.key) ? ctx.params.key : [];
  const key = parts.join("/").replace(/^\/+/, "").trim();
  if (!key) return new NextResponse("bad_request", { status: 400 });

  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, `/api/media/url?key=${encodeURIComponent(key)}`, "GET");

  if (out instanceof NextResponse) {
    out.headers.set("cache-control", "no-store");
    return out;
  }

  const { res, data, setCookies } = out;
  const url = data && typeof data.url === "string" ? String(data.url) : "";

  if (!res.ok || !url) {
    const status = res.status || 404;
    return new NextResponse(status === 401 ? "restricted" : status === 403 ? "forbidden" : "not_found", { status });
  }

  const r = NextResponse.redirect(url, { status: 302 });
  r.headers.set("cache-control", "no-store");
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
