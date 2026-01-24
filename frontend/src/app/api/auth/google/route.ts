import { NextResponse } from "next/server";
import { proxyJson } from "../_proxy";
import { applyProxyCookies } from "../_cookie";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/auth/google", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });

  applyProxyCookies(resp, data, setCookies || []);
  return resp;
}
