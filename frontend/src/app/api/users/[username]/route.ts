import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request, ctx: { params: { username: string } }) {
  const username = String(ctx?.params?.username || "").trim();
  const path = `/api/users/${encodeURIComponent(username)}`;

  const out = await proxyJson(req, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data } = out;
  return NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
}
