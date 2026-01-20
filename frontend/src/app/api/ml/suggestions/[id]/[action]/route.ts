import { NextResponse } from "next/server";
import { proxyJson } from "../../../../auth/_proxy";

const ALLOWED = new Set(["accept", "reject", "dismiss"]);

export async function POST(req: Request, { params }: { params: { id: string; action: string } }) {
  const id = String(params?.id || "");
  const action = String(params?.action || "").toLowerCase();
  if (!id || !ALLOWED.has(action)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const out = await proxyJson(req, `/api/ml/suggestions/${encodeURIComponent(id)}/${action}`, "POST", {});
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
