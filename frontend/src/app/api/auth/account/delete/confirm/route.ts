import { NextResponse } from "next/server";
import { proxyJson } from "../../../_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

function clearAuthCookies(resp: NextResponse) {
  resp.cookies.set("sessionid", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  resp.cookies.set("sd_viewer", "", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/auth/account/delete/confirm", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out as any;
  const resp = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  applySetCookies(resp, setCookies || []);
  if (res.ok && data?.ok && data?.deleted) {
    clearAuthCookies(resp);
  }
  return resp;
}
