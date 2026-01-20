import { NextResponse } from "next/server";
import { resolveBestInternalBase } from "../../../auth/_proxy";

function getSetCookies(res: Response): string[] {
  const h: any = (res as any).headers;
  if (h && typeof h.getSetCookie === "function") {
    try {
      const v = h.getSetCookie();
      if (Array.isArray(v)) return v as string[];
    } catch {
      // ignore
    }
  }
  const sc = res.headers.get("set-cookie");
  return sc ? [sc] : [];
}

export async function GET(req: Request) {
  const base = await resolveBestInternalBase();
  if (!base) {
    return NextResponse.json({ ok: false, error: "backend_not_configured" }, { status: 500 });
  }

  const src = new URL(req.url);
  const u = new URL("/api/moderation/audit/export", base);
  for (const k of ["format", "limit", "action", "targetType", "targetId"]) {
    const v = src.searchParams.get(k);
    if (v) u.searchParams.set(k, v);
  }

  const cookie = req.headers.get("cookie") || "";
  const csrf = req.headers.get("x-csrftoken") || "";
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  const reqId = req.headers.get("x-request-id") || "";

  const allowDevViewer = process.env.NODE_ENV !== "production";
  const xViewer = allowDevViewer ? req.headers.get("x-sd-viewer") || "" : "";

  const headers: Record<string, string> = {
    ...(cookie ? { cookie } : {}),
    ...(xViewer ? { "x-sd-viewer": xViewer } : {}),
    ...(csrf ? { "x-csrftoken": csrf } : {}),
    ...(origin ? { origin } : {}),
    ...(referer ? { referer } : {}),
    ...(reqId ? { "x-request-id": reqId } : {}),
  };

  try {
    const res = await fetch(u.toString(), {
      method: "GET",
      cache: "no-store",
      headers,
    });

    const buf = await res.arrayBuffer();
    const outHeaders = new Headers();
    outHeaders.set("cache-control", "no-store");

    const ct = res.headers.get("content-type");
    const cd = res.headers.get("content-disposition");
    if (ct) outHeaders.set("content-type", ct);
    if (cd) outHeaders.set("content-disposition", cd);

    for (const c of getSetCookies(res)) outHeaders.append("set-cookie", c);

    if (process.env.NODE_ENV !== "production") {
      try {
        outHeaders.set("x-sd-proxy-origin", base);
        outHeaders.set("x-sd-proxy-url", u.toString());
      } catch {
        // ignore
      }
    }

    return new NextResponse(buf, { status: res.status, headers: outHeaders });
  } catch {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 502 });
  }
}
