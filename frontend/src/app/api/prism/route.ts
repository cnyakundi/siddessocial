import { NextResponse } from "next/server";
import { proxyJson } from "../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

export async function GET(req: Request) {
  const out = await proxyJson(req, "/api/prism", "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
  applySetCookies(resp, setCookies || []);
  return resp;
}

export async function PATCH(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const out = await proxyJson(req, "/api/prism", "PATCH", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
  applySetCookies(resp, setCookies || []);
  return resp;
}
