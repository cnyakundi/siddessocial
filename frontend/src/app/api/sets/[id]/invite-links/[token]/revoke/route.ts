import { NextResponse } from "next/server";
import { proxyJson } from "../../../../../auth/_proxy";

// POST /api/sets/:id/invite-links/:token/revoke -> Django POST /api/sets/:id/invite-links/:token/revoke
export async function POST(req: Request, ctx: { params: { id: string; token: string } }) {
    const id = encodeURIComponent(String(ctx?.params?.id || "").trim());
  const token = encodeURIComponent(String(ctx?.params?.token || "").trim());
  const out = await proxyJson(req, `/api/sets/${id}/invite-links/${token}/revoke`, "POST", {});
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
