import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export async function GET(req: Request) {
  const out = await proxyJson(req, "/api/broadcasts/unread", "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;

  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
