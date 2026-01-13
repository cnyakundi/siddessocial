"use client";

import type { SideId } from "@/src/lib/sides";
import type { FeedItem, FeedProvider } from "@/src/lib/feedProvider";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const safe = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const m = document.cookie.match(new RegExp(`(?:^|; )${safe}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function localOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost";
}

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

function isRemoteBase(base: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return new URL(base).origin !== window.location.origin;
  } catch {
    return true;
  }
}

function usesDjangoBase(): { enabled: boolean; base: string | null } {
  const base = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE);
  if (!base) return { enabled: false, base: null };
  // Only treat it as "django mode" when it points off-origin (docker dev).
  return { enabled: isRemoteBase(base), base };
}

function withViewerHeader(init: RequestInit, viewer: string): RequestInit {
  const h = new Headers(init.headers || {});
  if (!h.has("x-sd-viewer")) h.set("x-sd-viewer", viewer);
  return { ...init, headers: h };
}

function buildUrl(side: SideId, baseOverride?: string): string {
  const base = baseOverride || localOrigin();
  const u = new URL("/api/feed", base);
  u.searchParams.set("side", side);
  return u.toString();
}

async function fetchWithFallback(side: SideId): Promise<Response> {
  const django = usesDjangoBase();
  const init: RequestInit = { cache: "no-store" };
  const viewer = getCookie("sd_viewer");
  const initWithViewer = viewer ? withViewerHeader(init, viewer) : init;

  // Primary: Django base (cross-origin) when configured.
  if (django.enabled && django.base) {
    try {
      const res = await fetch(buildUrl(side, django.base), initWithViewer);
      if (res.status < 500) return res;
    } catch {
      // fall through
    }
  }

  // Fallback: local Next API route.
  return fetch(buildUrl(side, undefined), init);
}

type FeedResp = { restricted?: boolean; items?: FeedItem[] };

export const backendStubProvider: FeedProvider = {
  name: "backend_stub",
  async list(side: SideId): Promise<FeedItem[]> {
    const res = await fetchWithFallback(side);
    if (!res.ok) return [];
    const data = (await res.json()) as FeedResp;
    if (data.restricted) return [];
    return (data.items || []) as FeedItem[];
  },
};
