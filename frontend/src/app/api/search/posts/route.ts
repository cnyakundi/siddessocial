import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const side = (url.searchParams.get("side") || "").trim();
  const setId = (url.searchParams.get("set") || "").trim();
  const topic = (url.searchParams.get("topic") || "").trim();
  const limit = (url.searchParams.get("limit") || "").trim();

  const qp = new URLSearchParams();
  if (q) qp.set("q", q);
  if (side) qp.set("side", side);
  if (setId) qp.set("set", setId);
  if (topic) qp.set("topic", topic);
  if (limit) qp.set("limit", limit);

  const path = `/api/search/posts${qp.toString() ? `?${qp.toString()}` : ""}`;
  const out = await proxyJson(req, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data } = out;
  return NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
}
