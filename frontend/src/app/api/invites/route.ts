import { NextResponse } from "next/server";
import { proxyJson } from "../auth/_proxy";

// GET /api/invites -> Django GET /api/invites
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.search || "";
  const out = await proxyJson(req, "/api/invites" + qs, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// POST /api/invites -> Django POST /api/invites
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/invites", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
