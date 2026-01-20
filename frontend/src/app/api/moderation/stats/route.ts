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

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; data: any | null } | null> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
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
  const u = new URL("/api/moderation/stats", base);
  const hours = url.searchParams.get("hours");
  if (hours) u.searchParams.set("hours", hours);

  const prox = await fetchJson(u.toString(), {
    method: "GET",
    headers: {
      cookie: req.headers.get("cookie") || "",
      ...(r.viewerId ? { "x-sd-viewer": r.viewerId } : {}),
      ...(csrf ? { "x-csrftoken": csrf } : {}),
      ...(origin ? { origin } : {}),
      ...(referer ? { referer } : {}),
      ...(reqId ? { "x-request-id": reqId } : {}),
    },
  });

  if (prox && prox.status < 500) {
    return NextResponse.json(prox.data ?? { ok: false, error: "bad_gateway" }, { status: prox.status });
  }

  return backendUnavailable();
}
