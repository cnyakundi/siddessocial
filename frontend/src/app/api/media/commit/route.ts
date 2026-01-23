import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

// POST /api/media/commit -> Django POST /api/media/commit
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const req2 = withDevViewer(req);

  const out = await proxyJson(req2, "/api/media/commit", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });

  applySetCookies(resp, setCookies || []);
  return resp;
}
