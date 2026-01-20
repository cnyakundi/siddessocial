import { NextResponse } from "next/server";
import { proxyJson } from "../../../_proxy";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const out = await proxyJson(req, "/api/auth/account/delete/request", "POST", {});
  if (out instanceof NextResponse) return out;
  const { res, data } = out;
  return NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
}
