import { NextResponse } from "next/server";
import { resolveBestInternalBase } from "../auth/_proxy";

// sd_583: Conditional requests pass-through for Public Slate (ETag / Last-Modified)
// GET /api/slate?target=@handle -> Django /api/slate?target=@handle

export const dynamic = "force-dynamic";
export const revalidate = 0;

function copyHeader(src: Headers, dst: Headers, name: string) {
  const v = src.get(name);
  if (v) dst.set(name, v);
}

export async function GET(req: Request) {
  const base = await resolveBestInternalBase();
  if (!base) {
    return NextResponse.json({ ok: false, error: "backend_not_configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const qs = url.search || "";
  const target = new URL("/api/slate" + qs, base).toString();

  const headers = new Headers();
  headers.set("accept", "application/json");
  // Forward conditional headers from browser.
  const inm = req.headers.get("if-none-match");
  if (inm) headers.set("if-none-match", inm);
  const ims = req.headers.get("if-modified-since");
  if (ims) headers.set("if-modified-since", ims);

  let res: Response;
  try {
    res = await fetch(target, { method: "GET", headers, cache: "no-store" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "proxy_fetch_failed", detail: String(e?.message || e || "unknown") },
      { status: 502 }
    );
  }

  // 304 must not include a body.
  if (res.status === 304) {
    const out = new NextResponse(null, { status: 304 });
    copyHeader(res.headers, out.headers, "etag");
    copyHeader(res.headers, out.headers, "last-modified");
    copyHeader(res.headers, out.headers, "cache-control");
    copyHeader(res.headers, out.headers, "vary");
    return out;
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: "bad_response" };
  }

  const out = NextResponse.json(data, { status: res.status });
  copyHeader(res.headers, out.headers, "etag");
  copyHeader(res.headers, out.headers, "last-modified");
  copyHeader(res.headers, out.headers, "cache-control");
  copyHeader(res.headers, out.headers, "vary");
  return out;
}
