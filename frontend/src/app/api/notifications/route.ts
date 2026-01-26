import { NextResponse } from "next/server";
import { proxyJson } from "../auth/_proxy";

// sd_181b: DB-backed notifications proxy (cookie-forwarding)
export async function GET(req: Request) {
  const out = await proxyJson(req, "/api/notifications", "GET");
  if (out instanceof NextResponse) {
    try { out.headers.set("cache-control", "no-store"); } catch {}
    return out;
  }
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
