import { NextResponse } from "next/server";
import { proxyJson } from "../_proxy";
import { applyProxyCookies } from "../_cookie";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function loggedOut200() {
  // Safe “not logged in” response (p0_gate expects 200)
  return NextResponse.json(
    { ok: true, authenticated: false },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

export async function GET(req: Request) {
  const out = await proxyJson(req, "/api/auth/me", "GET");

  // Some proxy failures return a NextResponse directly
  if (out instanceof NextResponse) {
    const st = (out as any)?.status;
    if (st === 401 || st === 403 || st === 404) return loggedOut200();
    return out;
  }

  const { res, data, setCookies } = out as any;

  // Treat “not logged in / not found” as a calm 200
  if (res?.status === 401 || res?.status === 403 || res?.status === 404) {
    return loggedOut200();
  }

  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });

  // If backend ever returns cookies, keep behavior consistent with other auth routes.
  applyProxyCookies(resp, data, setCookies || []);
  return resp;
}
