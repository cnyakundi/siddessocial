import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export async function DELETE(req: Request, { params }: { params: { token: string } }) {
  const token = String(params?.token || "").trim();
  if (!token) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const out = await proxyJson(req, `/api/blocks/${encodeURIComponent(token)}`, "DELETE");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
