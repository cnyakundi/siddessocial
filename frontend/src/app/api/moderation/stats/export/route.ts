import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";

function normalizeApiBase(raw: string | undefined | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.origin;
  } catch {
    return null;
  }
}

function backendNotConfigured() {
  const status = process.env.NODE_ENV === "production" ? 502 : 501;
  return NextResponse.json({ ok: false, error: "backend_not_configured" }, { status });
}

function backendUnavailable() {
  return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 502 });
}

export async function GET(req: Request) {
  const base = normalizeApiBase(process.env.SD_INTERNAL_API_BASE || process.env.NEXT_PUBLIC_API_BASE);
  if (!base) return backendNotConfigured();

  const csrf = req.headers.get("x-csrftoken") || "";
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  const reqId = req.headers.get("x-request-id") || "";
  const r = resolveStubViewer(req);

  const url = new URL(req.url);
  const u = new URL("/api/moderation/stats/export", base);
  for (const k of ["format", "hours"]) {
    const v = url.searchParams.get(k);
    if (v) u.searchParams.set(k, v);
  }

  try {
    const res = await fetch(u.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        cookie: req.headers.get("cookie") || "",
        ...(r.viewerId ? { "x-sd-viewer": r.viewerId } : {}),
        ...(csrf ? { "x-csrftoken": csrf } : {}),
        ...(origin ? { origin } : {}),
        ...(referer ? { referer } : {}),
        ...(reqId ? { "x-request-id": reqId } : {}),
      },
    });

    const buf = await res.arrayBuffer();
    const headers = new Headers();
    headers.set("cache-control", "no-store");

    const ct = res.headers.get("content-type");
    const cd = res.headers.get("content-disposition");
    if (ct) headers.set("content-type", ct);
    if (cd) headers.set("content-disposition", cd);

    return new NextResponse(buf, { status: res.status, headers });
  } catch {
    return backendUnavailable();
  }
}
