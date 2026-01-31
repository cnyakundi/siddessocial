import { NextResponse } from "next/server";

// sd_833_add_api_diag_endpoint
// Purpose: simple, safe proxy diagnostics for SD_INTERNAL_API_BASE.
// Notes:
// - Enabled by default in dev.
// - In production, returns 404 unless SIDDES_DIAG_ENABLED=1 (avoid leaking internal wiring).

type Probe = { url: string; ok: boolean; status?: number; ms?: number; error?: string };

function normalizeOrigin(raw: string | undefined | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.origin;
  } catch {
    // Allow bare host:port
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    return null;
  }
}

async function probeHealthz(origin: string, timeoutMs = 1200): Promise<Probe> {
  const started = Date.now();
  const url = origin.replace(/\/+$/, "") + "/healthz";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
      // Avoid leaking cookies: this endpoint should be public.
      headers: { "accept": "application/json, text/plain, */*" },
    });
    return { url, ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (e: any) {
    return { url, ok: false, ms: Date.now() - started, error: String(e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}

function envFlag(name: string): boolean {
  return String(process.env[name] || "").trim() !== "";
}

export async function GET() {
  const isProd = process.env.NODE_ENV === "production";
  const allowProd = String(process.env.SIDDES_DIAG_ENABLED || "").trim() === "1";
  if (isProd && !allowProd) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rawInternal = normalizeOrigin(process.env.SD_INTERNAL_API_BASE);
  const rawPublic = normalizeOrigin(process.env.NEXT_PUBLIC_API_BASE);

  const candidates: Array<{ origin: string; source: string }> = [];
  if (rawInternal) candidates.push({ origin: rawInternal, source: "SD_INTERNAL_API_BASE" });

  // In dev, allow fallback probing.
  // Important: NEXT_PUBLIC_API_BASE is usually correct for the browser, not necessarily for the Next server container.
  if (!isProd) {
    candidates.push({ origin: "http://backend:8000", source: "dev_default_backend_service" });
    candidates.push({ origin: "http://127.0.0.1:8000", source: "dev_loopback_127" });
    candidates.push({ origin: "http://localhost:8000", source: "dev_loopback_localhost" });
    if (rawPublic) candidates.push({ origin: rawPublic, source: "NEXT_PUBLIC_API_BASE" });
  }

  // De-dupe
  const uniq: Array<{ origin: string; source: string }> = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const k = c.origin;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(c);
  }

  let chosen: { origin: string; source: string } | null = null;
  let healthz: Probe | null = null;
  const tried: Probe[] = [];

  for (const c of uniq) {
    const p = await probeHealthz(c.origin, 1200);
    tried.push(p);
    if (p.ok) {
      chosen = c;
      healthz = p;
      break;
    }
  }

  const payload = {
    ok: true,
    now: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV || "development",
      has_SD_INTERNAL_API_BASE: envFlag("SD_INTERNAL_API_BASE"),
      has_NEXT_PUBLIC_API_BASE: envFlag("NEXT_PUBLIC_API_BASE"),
      SIDDES_DIAG_ENABLED: allowProd ? "1" : "0",
    },
    resolved: {
      chosenBase: chosen?.origin || null,
      source: chosen?.source || null,
      candidates: uniq,
    },
    healthz: healthz,
    tried,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
