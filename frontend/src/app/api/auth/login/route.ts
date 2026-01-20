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


export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/auth/login", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });

  // Forward non-session cookies only (e.g. csrftoken), but NOT sessionid.
  applySetCookies(resp, setCookies || []);
  // sd_232: Do NOT set sd_viewer here. Dev viewer is opt-in via StubViewerCookie only.
  return resp;
}
