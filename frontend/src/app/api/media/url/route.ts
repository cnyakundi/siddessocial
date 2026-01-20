import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/media/url?key=<r2Key> -> Django GET /api/media/url?key=<r2Key>
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.search || "";
  const out = await proxyJson(req, "/api/media/url" + qs, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
