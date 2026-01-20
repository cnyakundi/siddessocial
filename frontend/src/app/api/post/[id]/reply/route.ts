import { NextResponse } from "next/server";
import { proxyJson } from "../../../auth/_proxy";

// POST /api/post/:id/reply -> Django POST /api/post/:id/reply
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));

  const out = await proxyJson(req, `/api/post/${id}/reply`, "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
