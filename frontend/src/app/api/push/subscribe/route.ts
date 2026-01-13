import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Demo-only: accept subscription JSON; do not persist.
  // Real implementation should authenticate user and store subscriptions by user_id + endpoint.
  try {
    const body = await req.json();
    const sub = body?.subscription;
    if (!sub) {
      return NextResponse.json({ ok: false, error: "missing subscription" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, stored: false, message: "stub (not persisted)" });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
}
