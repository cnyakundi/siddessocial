import { NextResponse } from "next/server";
import { proxyJson } from "../../../auth/_proxy";

// POST /api/invite-links/:token/accept -> Django POST /api/invite-links/:token/accept
export async function POST(req: Request, ctx: { params: { token: string } }) {
  const token = ctx?.params?.token;
  const out = await proxyJson(req, `/api/invite-links/${token}/accept`, "POST", {});
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
