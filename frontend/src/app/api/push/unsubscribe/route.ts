import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Demo-only: accept endpoint; do not persist.
  try {
    const body = await req.json();
    const endpoint = body?.endpoint;
    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "missing endpoint" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, removed: false, message: "stub (not persisted)" });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
}
