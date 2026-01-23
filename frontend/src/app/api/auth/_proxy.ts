import { NextResponse } from "next/server";

export type ProxyJsonOut = {
  res: Response;
  data: any;
  setCookies: string[];
};

function genRequestId(): string {
  try {
    const rid = (globalThis as any).crypto?.randomUUID?.();
    if (rid) return String(rid).replace(/-/g, "").slice(0, 16);
  } catch {
    // ignore
  }
  const a = Math.random().toString(16).slice(2);
  const b = Math.random().toString(16).slice(2);
  return (a + b).replace(/[^a-f0-9]/g, "").slice(0, 16) || "0000000000000000";
}

/**
 * Resolve a backend origin.
 * Priority:
 * 1) SD_INTERNAL_API_BASE / NEXT_PUBLIC_API_BASE (explicit)
 * 2) Dev fallback: 127.0.0.1:<SIDDES_BACKEND_PORT|SD_BACKEND_PORT|BACKEND_PORT|8000>
 * 3) Prod: fail closed (null)
 */
export function resolveInternalBase(): string | null {
  const raw = process.env.SD_INTERNAL_API_BASE || process.env.NEXT_PUBLIC_API_BASE;
  const s = String(raw || "").trim();
  if (s) {
    try {
      const u = new URL(s);
      return u.origin;
    } catch {
      try {
        const u = new URL("http://" + s);
        return u.origin;
      } catch {
        // fall through
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const p = String(
      process.env.SIDDES_BACKEND_PORT || process.env.SD_BACKEND_PORT || process.env.BACKEND_PORT || "8000"
    ).trim();
    const port = /^\d+$/.test(p) ? p : "8000";
    return `http://127.0.0.1:${port}`;
  }

  return null;
}

let _cachedBest: { base: string; checkedAt: number } | null = null;
const BEST_TTL_MS = 30_000;

async function probeHealthz(origin: string): Promise<boolean> {
  const url = new URL("/healthz", origin).toString();
  const ac = new AbortController();
  // Slightly more forgiving: avoids false negatives on busy laptops.
  const t = setTimeout(() => ac.abort(), 650);
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: ac.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function addPortCandidates(candidates: string[], port: string | number) {
  const p = String(port || "").trim();
  if (!/^\d+$/.test(p)) return;
  // Host-mode
  candidates.push(`http://127.0.0.1:${p}`);
  candidates.push(`http://localhost:${p}`);
  // Docker-to-host (Mac/Windows). Harmless elsewhere (will just fail the probe).
  candidates.push(`http://host.docker.internal:${p}`);
}

/**
 * Dev helper: find the correct backend origin.
 *
 * Why this exists:
 * - Some devs run frontend on host + backend in Docker, or vice-versa.
 * - Ports may shift (8000..8010) depending on what's free.
 *
 * Rules:
 * - In production: fail closed (no scanning).
 * - In dev: probe /healthz across a small candidate set and cache briefly.
 */
export async function resolveBestInternalBase(): Promise<string | null> {
  if (process.env.NODE_ENV === "production") {
    return resolveInternalBase();
  }

  const now = Date.now();
  if (_cachedBest && now - _cachedBest.checkedAt < BEST_TTL_MS) return _cachedBest.base;

  const candidates: string[] = [];

  const explicit = String(process.env.SD_INTERNAL_API_BASE || process.env.NEXT_PUBLIC_API_BASE || "").trim();
  const explicitOrigin = explicit ? resolveInternalBase() : null;
  if (explicitOrigin) candidates.push(explicitOrigin);

  // Docker compose service origin (frontend+backend in docker network).
  candidates.push("http://backend:8000");

  // Env port (if set) + 8000..8010 scan.
  const envPort = String(
    process.env.SIDDES_BACKEND_PORT || process.env.SD_BACKEND_PORT || process.env.BACKEND_PORT || ""
  ).trim();
  if (/^\d+$/.test(envPort)) addPortCandidates(candidates, envPort);

  for (let p = 8000; p <= 8010; p++) addPortCandidates(candidates, p);

  // Last-resort fallback (usually 127.0.0.1:8000)
  const fallback = resolveInternalBase();
  if (fallback) candidates.push(fallback);

  // Probe concurrently (fast) but honor preference order when selecting.
  const origins = uniq(candidates.filter(Boolean));
  const oks = await Promise.all(origins.map((o) => probeHealthz(o)));
  for (let i = 0; i < origins.length; i++) {
    if (oks[i]) {
      _cachedBest = { base: origins[i], checkedAt: now };
      return origins[i];
    }
  }

  // Nothing healthy — return explicit or fallback without caching.
  return explicitOrigin || fallback;
}

function getSetCookies(res: Response): string[] {
  const h: any = (res as any).headers;
  if (h && typeof h.getSetCookie === "function") {
    try {
      const v = h.getSetCookie();
      if (Array.isArray(v)) return v as string[];
    } catch {
      // fall through
    }
  }
  const sc = res.headers.get("set-cookie");
  return sc ? [sc] : [];
}

function buildProxyHeaders(req: Request, requestId: string): Record<string, string> {
  const cookie = req.headers.get("cookie") || "";
  const allowDevViewer = process.env.NODE_ENV !== "production";
  const xViewer = allowDevViewer ? req.headers.get("x-sd-viewer") || "" : "";
  const sdSide = req.headers.get("x-sd-side") || "";
  const csrf = req.headers.get("x-csrftoken") || "";
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";

  // sd_399: forward geo headers (coarse country only)
  const cfCountry = req.headers.get("cf-ipcountry") || "";
  const vercelCountry = req.headers.get("x-vercel-ip-country") || "";
  const cloudfrontCountry = req.headers.get("cloudfront-viewer-country") || "";
  const geoCountry = req.headers.get("x-geo-country") || "";
  const appEngineCountry = req.headers.get("x-appengine-country") || "";

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-request-id": requestId,
  };
  if (cookie) headers.cookie = cookie;
  if (xViewer) headers["x-sd-viewer"] = xViewer;
  if (sdSide) headers["x-sd-side"] = sdSide;
  if (csrf) headers["x-csrftoken"] = csrf;
  if (origin) headers.origin = origin;
  if (referer) headers.referer = referer;

  // sd_399: pass through provider geo hints (used for defaults only)
  if (cfCountry) headers["cf-ipcountry"] = cfCountry;
  if (vercelCountry) headers["x-vercel-ip-country"] = vercelCountry;
  if (cloudfrontCountry) headers["cloudfront-viewer-country"] = cloudfrontCountry;
  if (geoCountry) headers["x-geo-country"] = geoCountry;
  if (appEngineCountry) headers["x-appengine-country"] = appEngineCountry;

  return headers;
}

async function doFetch(url: string, method: string, headers: Record<string, string>, body?: any): Promise<Response> {
  return await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

export async function proxyJson(
  req: Request,
  path: string,
  method: string,
  body?: any
): Promise<ProxyJsonOut | NextResponse> {
  const requestId = req.headers.get("x-request-id") || genRequestId();
  const headers = buildProxyHeaders(req, requestId);

  let base = await resolveBestInternalBase();

  if (!base) {
    return NextResponse.json({ ok: false, error: "backend_not_configured", requestId }, { status: 500 });
  }

  const mkUrl = (b: string) => new URL(path, b).toString();

  let res: Response | null = null;
  let lastErr: any = null;
  let url = mkUrl(base);

  try {
    res = await doFetch(url, method, headers, body);
  } catch (e: any) {
    lastErr = e;
  }

  // Dev hardening: if we failed to connect, clear cache and rescan once.
  if (!res && process.env.NODE_ENV !== "production") {
    try {
      _cachedBest = null;
      const base2 = await resolveBestInternalBase();
      if (base2 && base2 !== base) {
        base = base2;
        url = mkUrl(base);
        res = await doFetch(url, method, headers, body);
        lastErr = null;
      }
    } catch (e2: any) {
      lastErr = e2;
    }
  }

  if (!res) {
    const resp = NextResponse.json(
      {
        ok: false,
        error: "proxy_fetch_failed",
        detail: String(lastErr?.message || lastErr || "unknown"),
        url,
        requestId,
      },
      { status: 502 }
    );
    if (process.env.NODE_ENV !== "production") {
      try {
        resp.headers.set("x-sd-proxy-origin", base);
        resp.headers.set("x-sd-proxy-url", url);
      } catch {}
    }
    return resp;
  }

  const setCookies = getSetCookies(res);

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: "bad_response", requestId };
  }

  // Attach correlation id to JSON payloads for UI/support.
  try {
    const rid = res.headers.get("x-request-id") || requestId;
    if (rid && data && typeof data === "object" && !Array.isArray(data) && !("requestId" in data)) {
      (data as any).requestId = rid;
    }
  } catch {
    // ignore
  }

  return { res, data, setCookies };
}
