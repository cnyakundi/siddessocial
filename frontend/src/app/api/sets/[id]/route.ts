import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const url = new URL(req.url);
  const qs = url.search || "";
  const out = await proxyJson(req, `/api/sets/${id}${qs}`, "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// PATCH parity: the Sets provider uses PATCH /api/sets/:id to update set metadata.
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, `/api/sets/${id}`, "PATCH", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}


export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const out = await proxyJson(req, `/api/sets/${id}`, "DELETE");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
