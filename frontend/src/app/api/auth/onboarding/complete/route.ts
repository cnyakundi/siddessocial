import { NextResponse } from "next/server";
import { proxyJson } from "../../_proxy";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/auth/onboarding/complete", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data } = out;
  return NextResponse.json(data, { status: res.status });
}
