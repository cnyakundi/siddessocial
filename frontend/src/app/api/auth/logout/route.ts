import { NextResponse } from "next/server";
import { proxyJson } from "../_proxy";

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

export async function POST(req: Request) {
  const out = await proxyJson(req, "/api/auth/logout", "POST", {});
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, { status: res.status });

  // If Django clears/rotates cookies, forward those too.
  applySetCookies(resp, setCookies);

  // Clear cookies on the Next domain (defense-in-depth).
  resp.cookies.set("sessionid", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  resp.cookies.set("sd_viewer", "", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 0 });

  return resp;
}
