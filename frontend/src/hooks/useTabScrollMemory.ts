"use client";

import { useEffect, useRef } from "react";

const MAP_KEY = "sd.tabscroll.map.v1";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

type Entry = { y: number; ts: number };
type ScrollMap = Record<string, Entry>;

function getPath() {
  return window.location.pathname + window.location.search;
}

function isTrackable(path: string) {
  // Facebook-like memory for primary surfaces.
  return (
    path.startsWith("/siddes-feed") ||
    path.startsWith("/siddes-inbox") ||
    path.startsWith("/siddes-sets") ||
    path.startsWith("/siddes-search") ||
    path.startsWith("/siddes-notifications") ||
    path.startsWith("/u/")
  );
}

function loadMap(): ScrollMap {
  try {
    const raw = window.sessionStorage.getItem(MAP_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? (j as ScrollMap) : {};
  } catch {
    return {};
  }
}

function saveMap(m: ScrollMap) {
  try {
    window.sessionStorage.setItem(MAP_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}

function writeEntry(path: string, y: number) {
  try {
    const m = loadMap();
    m[path] = { y, ts: Date.now() };
    saveMap(m);
  } catch {
    // ignore
  }
}

function readEntry(path: string): Entry | null {
  try {
    const m = loadMap();
    const e: any = (m as any)[path];
    if (!e || typeof e !== "object") return null;
    const y = Number(e.y);
    const ts = Number(e.ts);
    if (!Number.isFinite(y) || !Number.isFinite(ts)) return null;
    if (Date.now() - ts > MAX_AGE_MS) return null;
    return { y, ts };
  } catch {
    return null;
  }
}

function hasReturnScrollFor(path: string) {
  // If the list→detail returnScroll hook is active for this path, let it win.
  try {
    return window.sessionStorage.getItem("sd.return.path") === path;
  } catch {
    return false;
  }
}

/**
 * sd_783_tab_scroll_memory:
 * Keep tab/page scroll positions across navigation (FB-like “remember where I was”).
 * - Stores scrollY for trackable surfaces on scroll (throttled).
 * - Restores on navigation into that surface (unless returnScroll is active).
 */
export function useTabScrollMemory(depKey: string) {
  const pathRef = useRef<string>("");
  const lastWriteRef = useRef<number>(0);

  // Keep current path in a ref for the scroll listener.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      pathRef.current = getPath();
    } catch {
      pathRef.current = "";
    }
  }, [depKey]);

  // Persist scroll for the current page (throttled).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScroll = () => {
      try {
        const path = pathRef.current || getPath();
        if (!isTrackable(path)) return;

        const t = Date.now();
        if (t - lastWriteRef.current < 200) return; // throttle
        lastWriteRef.current = t;

        const y = Math.max(0, Math.round(window.scrollY || 0));
        writeEntry(path, y);
      } catch {
        // ignore
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    // Save once on mount too (in case user doesn't scroll).
    window.setTimeout(() => {
      try {
        onScroll();
      } catch {}
    }, 0);

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Restore on navigation into a trackable surface.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let path = "";
    try {
      path = getPath();
      pathRef.current = path;
    } catch {
      return;
    }

    if (!isTrackable(path)) return;
    if (hasReturnScrollFor(path)) return;

    const e = readEntry(path);
    if (!e) return;

    const target = Math.max(0, Math.round(Number.isFinite(e.y) ? e.y : 0));
    const scrollToTarget = () => window.scrollTo({ top: target, left: 0, behavior: "auto" });

    // Let layout settle (virtualized lists / dynamic modules).
    requestAnimationFrame(scrollToTarget);
    window.setTimeout(scrollToTarget, 120);
    window.setTimeout(scrollToTarget, 260);
  }, [depKey]);
}
