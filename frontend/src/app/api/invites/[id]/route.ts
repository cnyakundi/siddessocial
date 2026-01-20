import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

// GET /api/invites/:id -> Django GET /api/invites/:id
export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const out = await proxyJson(req, `/api/invites/${id}`, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// PATCH /api/invites/:id -> Django PATCH /api/invites/:id
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, `/api/invites/${id}`, "PATCH", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
