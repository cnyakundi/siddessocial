import { NextResponse } from "next/server";
import { proxyJson } from "../../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request, ctx: { params: { username: string } }) {
  const url = new URL(req.url);
  const limit = (url.searchParams.get("limit") || "").trim();
  const username = String(ctx?.params?.username || "").trim();

  const qp = new URLSearchParams();
  if (limit) qp.set("limit", limit);

  const path = `/api/users/${encodeURIComponent(username)}/posts${qp.toString() ? `?${qp.toString()}` : ""}`;
  const out = await proxyJson(req, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data } = out;
  return NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
}
