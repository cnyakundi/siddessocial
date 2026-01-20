import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.search || "";
  const out = await proxyJson(req, "/api/broadcasts/feed" + qs, "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;

  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
