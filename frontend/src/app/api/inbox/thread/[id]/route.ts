import { NextResponse } from "next/server";
import { proxyJson } from "../../../auth/_proxy";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const url = new URL(req.url);
  const qs = url.search || "";
  const out = await proxyJson(req, `/api/inbox/thread/${id}${qs}`, "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

// POST parity: Inbox provider uses POST /api/inbox/thread/:id to send messages
// (body: { text, clientKey? }) and to change the locked side (body: { setLockedSide }).
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, `/api/inbox/thread/${id}`, "POST", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
