import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

// sd_310: mark all notifications read (cookie-forwarding)
export async function POST(req: Request) {
  const out = await proxyJson(req, "/api/notifications/mark-all-read", "POST");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
