import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// sd_533: Siddes has no follower graph. This endpoint is intentionally removed.
export async function POST() {
  return NextResponse.json({ ok: false, error: "deprecated" }, {
    status: 404,
    headers: { "cache-control": "no-store" },
  });
}
