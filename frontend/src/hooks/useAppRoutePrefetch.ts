"use client";

// sd_907_pwa_route_prefetch:
// Prefetch core “tab routes” on idle so BottomNav feels Twitter-Lite instant.
// Uses sd_785_tab_route_memory (sessionStorage key: sd.tabroute.map.v1) when available.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const KEY_TS = "sd.routeprefetch.ts";
const MIN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_TIMEOUT_MS = 1200;

function fullPath(): string {
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return "";
  }
}

function getConn(): any {
  try {
    const n: any = navigator as any;
    return n?.connection || n?.mozConnection || n?.webkitConnection || null;
  } catch {
    return null;
  }
}

function canPrefetchNow(): boolean {
  // Allow a hard disable via env (build-time).
  if (String(process.env.NEXT_PUBLIC_SD_ROUTE_PREFETCH || "").trim() === "0") return false;

  if (typeof window === "undefined") return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;

  const c = getConn();
  if (c?.saveData) return false;

  const et = String(c?.effectiveType || "").toLowerCase();
  if (et.includes("2g") || et.includes("slow-2g")) return false;

  return true;
}

function shouldRun(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY_TS) || "0");
    if (!Number.isFinite(last) || !last) return true;
    return Date.now() - last >= MIN_INTERVAL_MS;
  } catch {
    return true;
  }
}

function markRun() {
  try {
    window.sessionStorage.setItem(KEY_TS, String(Date.now()));
  } catch {
    // ignore
  }
}

function loadTabRouteMap(): { feed?: string; alerts?: string; inbox?: string; me?: string } {
  try {
    const raw = window.sessionStorage.getItem("sd.tabroute.map.v1");
    if (!raw) return {};
    const j: any = JSON.parse(raw);
    if (!j || typeof j !== "object") return {};
    const pick = (v: any) => (typeof v === "string" && v.startsWith("/siddes-")) ? v : undefined;
    return {
      feed: pick(j.feed) || "/siddes-feed",
      alerts: pick(j.alerts) || "/siddes-notifications",
      inbox: pick(j.inbox) || "/siddes-inbox",
      me: pick(j.me) || "/siddes-profile",
    };
  } catch {
    return {
      feed: "/siddes-feed",
      alerts: "/siddes-notifications",
      inbox: "/siddes-inbox",
      me: "/siddes-profile",
    };
  }
}

function scheduleIdle(fn: () => void) {
  try {
    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: any) => number) | undefined;
    if (typeof ric === "function") {
      ric(fn, { timeout: IDLE_TIMEOUT_MS });
      return;
    }
  } catch {}
  window.setTimeout(fn, 300);
}

export function useAppRoutePrefetch(depKey: string) {
  const router = useRouter();
  const inflightRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const run = () => {
      if (inflightRef.current) return;
      if (!canPrefetchNow()) return;
      if (!shouldRun()) return;

      inflightRef.current = true;
      markRun();

      scheduleIdle(() => {
        try {
          const here = fullPath();

          const map = loadTabRouteMap();
          const routes: string[] = [];

          // Prefer the *actual* last route per tab (sd_785).
          routes.push(map.feed || "/siddes-feed");
          routes.push(map.alerts || "/siddes-notifications");
          routes.push(map.inbox || "/siddes-inbox");
          routes.push(map.me || "/siddes-profile");

          // Compose is always a primary tab; prefetch base route (query params share the chunk).
          routes.push("/siddes-compose");

          // De-dupe, skip current.
          const uniq: string[] = [];
          for (const r of routes) {
            const v = String(r || "").trim();
            if (!v) continue;
            if (v === here) continue;
            if (uniq.includes(v)) continue;
            uniq.push(v);
            if (uniq.length >= 6) break;
          }

          for (const href of uniq) {
            try {
              router.prefetch(href);
            } catch {
              // ignore
            }
          }
        } finally {
          inflightRef.current = false;
        }
      });
    };

    // First run after mount/navigation settles.
    const t = window.setTimeout(run, 500);

    // “Wake” triggers (throttled by shouldRun()).
    const onWake = () => run();
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      try { window.clearTimeout(t); } catch {}
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [depKey, router]);
}
