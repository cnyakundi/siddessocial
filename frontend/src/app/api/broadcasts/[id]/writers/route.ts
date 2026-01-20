import { NextResponse } from "next/server";
import { proxyJson } from "../../../auth/_proxy";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const out = await proxyJson(req, `/api/broadcasts/${id}/writers`, "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, `/api/broadcasts/${id}/writers`, "POST", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, `/api/broadcasts/${id}/writers`, "DELETE", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
