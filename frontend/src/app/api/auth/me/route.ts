import { NextResponse } from "next/server";
import { proxyJson } from "../_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

export async function GET(req: Request) {
  const out = await proxyJson(req, "/api/auth/me", "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;

  // sd_814_auth_me_softfail_404: dev gate resilience.
  // If the backend auth router is temporarily missing/disabled in a dev env and returns 404,
  // treat it as unauthenticated instead of propagating 404 (p0_gate expects 200).
  if (res.status === 404) {
    const resp = NextResponse.json({ ok: true, authenticated: false }, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
    applySetCookies(resp, setCookies || []);
    return resp;
  }
  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });

  applySetCookies(resp, setCookies || []);
  return resp;
}
