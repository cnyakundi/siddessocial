import { NextResponse } from "next/server";
import { proxyJson } from "../../../auth/_proxy";

// GET /api/sets/:id/invite-links -> Django GET /api/sets/:id/invite-links
export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const out = await proxyJson(req, `/api/sets/${id}/invite-links`, "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// POST /api/sets/:id/invite-links -> Django POST /api/sets/:id/invite-links
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, `/api/sets/${id}/invite-links`, "POST", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
