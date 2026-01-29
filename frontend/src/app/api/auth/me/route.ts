import { NextResponse } from "next/server";
import { proxyJson } from "../_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function attachSetCookies(resp: NextResponse, setCookies: string[] | null | undefined) {
  const arr = Array.isArray(setCookies) ? setCookies : [];
  for (const c of arr) {
    try {
      resp.headers.append("set-cookie", String(c));
    } catch {
      // ignore
    }
  }
}

function loggedOut200(setCookies?: string[] | null) {
  const resp = NextResponse.json(
    { ok: true, authenticated: false, viewer: null },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
  attachSetCookies(resp, setCookies || []);
  return resp;
}

export async function GET(req: Request) {
  const out = await proxyJson(req, "/api/auth/me", "GET");

  // If proxyJson returns a NextResponse directly (e.g. base missing / fetch failed)
  if (out instanceof NextResponse) {
    try {
      out.headers.set("cache-control", "no-store");
    } catch {}

    // Dev-safe: treat these as “logged out”
    if (out.status === 401 || out.status === 403 || out.status === 404) {
      return loggedOut200();
    }
    return out;
  }

  const { res, data, setCookies } = out as any;

  if (res?.status === 401 || res?.status === 403 || res?.status === 404) {
    return loggedOut200(setCookies || []);
  }

  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
  attachSetCookies(resp, setCookies || []);
  return resp;
}
