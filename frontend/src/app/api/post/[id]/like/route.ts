import { NextResponse } from "next/server";
import { proxyJson } from "../../../auth/_proxy";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = String(params?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const out = await proxyJson(req, `/api/post/${encodeURIComponent(id)}/like`, "POST", {});
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const id = String(params?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const out = await proxyJson(req, `/api/post/${encodeURIComponent(id)}/like`, "DELETE");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
