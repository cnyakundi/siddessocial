import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

// GET /api/inbox/typing -> Django GET /api/inbox/typing
export async function GET(req: Request) {
  const url = new URL(req.url);
  const out = await proxyJson(req, "/api/inbox/typing" + (url.search || ""), "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// POST /api/inbox/typing -> Django POST /api/inbox/typing
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/inbox/typing", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
