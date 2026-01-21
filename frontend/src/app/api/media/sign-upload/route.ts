import { NextResponse } from "next/server";
import { proxyJson } from "@/src/app/api/auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST /api/media/sign-upload -> Django POST /api/media/sign-upload
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/media/sign-upload", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies || []) r.headers.append("set-cookie", c);
  return r;
}
