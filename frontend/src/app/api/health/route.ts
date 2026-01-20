import { NextResponse } from "next/server";
import { resolveBestInternalBase } from "../auth/_proxy";

// /api/health (Next) -> /api/health (Django)
// Safe endpoint used by launch checks and ops probes.
export async function GET(req: Request) {
  const isProd = process.env.NODE_ENV === "production";
  const base = await resolveBestInternalBase();

  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        error: "backend_not_configured",
        hint: "Set SD_INTERNAL_API_BASE (or NEXT_PUBLIC_API_BASE) to your Django origin, e.g. http://127.0.0.1:8000",
      },
      { status: 500 }
    );
  }

  const url = new URL("/api/health", base);
  const cookie = req.headers.get("cookie") || "";

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "bad_gateway", hint: "Django /api/health is unreachable", detail: String(e?.message || e) },
      { status: 502 }
    );
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = { ok: res.ok };
  }

  const out = NextResponse.json(data, { status: res.status });
  if (!isProd) out.headers.set("x-sd-proxy-origin", base);
  return out;
}
