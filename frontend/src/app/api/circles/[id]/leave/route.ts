import { NextResponse } from "next/server";
import { proxyJson } from "../../../auth/_proxy";

// POST parity: leave a Circle as a non-owner member.
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const id = String(ctx?.params?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const out = await proxyJson(req, `/api/circles/${encodeURIComponent(id)}/leave`, "POST");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
