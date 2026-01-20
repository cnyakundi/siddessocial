import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = (url.searchParams.get("limit") || "").trim();

  const qp = new URLSearchParams();
  if (q) qp.set("q", q);
  if (limit) qp.set("limit", limit);

  const path = `/api/search/users${qp.toString() ? `?${qp.toString()}` : ""}`;
  const out = await proxyJson(req, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data } = out;
  return NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
}
