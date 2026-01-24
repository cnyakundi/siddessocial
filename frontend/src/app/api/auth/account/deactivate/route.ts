import { NextResponse } from "next/server";
import { proxyJson } from "../../_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

function clearAuthCookies(resp: NextResponse) {
  // Mirror /api/auth/logout behavior (defense-in-depth)
  resp.cookies.set("sessionid", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  resp.cookies.set("sd_viewer", "", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function POST(req: Request) {
  const out = await proxyJson(req, "/api/auth/account/deactivate", "POST", {});
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out as any;
  const resp = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  applySetCookies(resp, setCookies || []);
  if (res.ok && data?.ok && data?.deactivated) {
    clearAuthCookies(resp);
  }
  return resp;
}
