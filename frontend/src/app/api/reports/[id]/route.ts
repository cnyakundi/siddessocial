import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const id = String(ctx?.params?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, `/api/reports/${encodeURIComponent(id)}`, "PATCH", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
