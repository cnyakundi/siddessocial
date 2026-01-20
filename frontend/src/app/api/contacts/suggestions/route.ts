import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

// sd_181l: DB-backed contacts suggestions proxy
export async function GET(req: Request) {
  const out = await proxyJson(req, "/api/contacts/suggestions", "GET");
  if (out instanceof NextResponse) return out;

  const { res, data } = out;
  return NextResponse.json(data, { status: res.status });
}
