import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/media/commit", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
  for (const c of setCookies || []) resp.headers.append("set-cookie", c);
  return resp;
}
