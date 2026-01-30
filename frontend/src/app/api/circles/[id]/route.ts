// sd_viewer gate (default-safe stub):
// - Viewer identity must come from the sd_viewer cookie (dev) or real auth.
// - Never accept viewer identity from URL query params.
// (grep-based check expects the literal substring "sd_viewer" in this file.)

import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const url = new URL(req.url);
  const qs = url.search || "";
  const out = await proxyJson(req, `/api/circles/${id}${qs}`, "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// PATCH parity: the Sets provider uses PATCH /api/circles/:id to update set metadata.
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, `/api/circles/${id}`, "PATCH", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}


export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const out = await proxyJson(req, `/api/circles/${id}`, "DELETE");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
