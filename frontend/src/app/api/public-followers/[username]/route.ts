import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

export async function GET(req: Request, ctx: { params: { username: string } }) {
  const raw = String(ctx?.params?.username || "");
  const username = decodeURIComponent(raw);
  const u = new URL(req.url);
  const path = "/api/public-followers/" + encodeURIComponent(username) + (u.search || "");

  const out = await proxyJson(req, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  applySetCookies(resp, setCookies || []);
  return resp;
}
