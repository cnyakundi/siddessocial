import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

// sd_801: mark specific notifications read (cookie-forwarding)
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const out = await proxyJson(req, "/api/notifications/mark-read", "POST", body);
  if (out instanceof NextResponse) {
    try { out.headers.set("cache-control", "no-store"); } catch {}
    return out;
  }
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
