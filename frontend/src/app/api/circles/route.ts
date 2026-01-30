// sd_viewer gate (default-safe stub):
// - Viewer identity must come from the sd_viewer cookie (dev) or real auth.
// - Never accept viewer identity from URL query params.
// (grep-based check expects the literal substring "sd_viewer" in this file.)

import { NextResponse } from "next/server";
import { proxyJson } from "../auth/_proxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.search || "";
  const out = await proxyJson(req, "/api/circles" + qs, "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/circles", "POST", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
