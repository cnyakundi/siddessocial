import { NextResponse } from "next/server";
import { resolveInternalBase, resolveBestInternalBase } from "../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function redactOrigin(s: string): string {
  const raw = String(s || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    // If someone set a bare host like api.example.com, show only the host-ish prefix.
    const x = raw.replace(/^https?:\/\//i, "").split("/")[0] || raw;
    if (x.length <= 48) return x;
    return x.slice(0, 45) + "…";
  }
}

async function probeHealthz(origin: string): Promise<{ ok: boolean; status?: number; ms: number; error?: string } | null> {
  const base = String(origin || "").trim();
  if (!base) return null;

  const url = new URL("/healthz", base).toString();
  const ac = new AbortController();
  const t0 = Date.now();
  const t = setTimeout(() => ac.abort(), 900);

  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: ac.signal });
    return { ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - t0, error: String(e?.message || e || "probe_failed") };
  } finally {
    clearTimeout(t);
  }
}

// GET /api/_diag
// - Safe: returns only coarse config booleans + chosen backend origin + health probe.
// - Useful when prod is misconfigured ("backend_not_configured").
export async function GET() {
  const nodeEnv = String(process.env.NODE_ENV || "");
  const raw = String(process.env.SD_INTERNAL_API_BASE || process.env.NEXT_PUBLIC_API_BASE || "").trim();
  const hasRaw = !!raw;

  const internal = resolveInternalBase();
  const best = await resolveBestInternalBase();

  const base = best || internal || null;
  const healthz = base ? await probeHealthz(base) : null;

  const ok = !!base && !!healthz?.ok;

  const hint =
    nodeEnv === "production" && !base
      ? "Set SD_INTERNAL_API_BASE on Vercel to your Django origin, e.g. https://api.yourdomain.com"
      : !healthz?.ok && base
        ? "Backend origin resolved but /healthz is unreachable. Check backend deploy + firewall + domain/DNS."
        : undefined;

  return NextResponse.json(
    {
      ok,
      nodeEnv,
      configured: {
        has_SD_INTERNAL_API_BASE: !!String(process.env.SD_INTERNAL_API_BASE || "").trim(),
        has_NEXT_PUBLIC_API_BASE: !!String(process.env.NEXT_PUBLIC_API_BASE || "").trim(),
        rawHint: hasRaw ? redactOrigin(raw) : "",
      },
      resolved: {
        internalBase: internal,
        bestBase: best,
        chosenBase: base,
      },
      healthz,
      hint,
    },
    {
      status: ok ? 200 : 200,
      headers: { "cache-control": "no-store" },
    }
  );
}
