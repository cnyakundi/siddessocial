"use client";

// sd_914_fast_scroll_mode:
// Detect very fast scrolling and set a global flag + body class.
// This lets us defer heavy work (like image decode) until the user stops flinging.

import { useEffect, useRef } from "react";
import { FLAGS } from "@/src/lib/flags";

type Win = typeof window & {
  __SD_FAST_SCROLL__?: boolean;
};

function setFast(v: boolean) {
  try {
    (window as Win).__SD_FAST_SCROLL__ = v;
  } catch {}
  try {
    document?.body?.classList?.toggle("sd-fast-scroll", v);
  } catch {}
}

export function useScrollPerformanceMode(depKey: string) {
  const lastYRef = useRef(0);
  const lastTRef = useRef(0);
  const fastRef = useRef(false);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!FLAGS || (FLAGS as any).fastScrollMode === false) return;
    if (typeof window === "undefined") return;

    // Reset on navigation
    fastRef.current = false;
    setFast(false);

    const now = () => {
      try {
        return (window.performance && typeof window.performance.now === "function") ? window.performance.now() : Date.now();
      } catch {
        return Date.now();
      }
    };

    const armClear = () => {
      try {
        if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      } catch {}
      clearTimerRef.current = window.setTimeout(() => {
        fastRef.current = false;
        setFast(false);
      }, 140);
    };

    const onScroll = () => {
      try {
        const y = Math.max(0, Number(window.scrollY || 0));
        const t = now();

        const dy = Math.abs(y - lastYRef.current);
        const dt = Math.max(1, t - lastTRef.current);

        // px/ms (e.g. 1.2 ~ 1200px/sec)
        const v = dy / dt;

        lastYRef.current = y;
        lastTRef.current = t;

        // Only consider as fast when movement is meaningful.
        const isFast = dy > 26 && v > 1.15;

        if (isFast && !fastRef.current) {
          fastRef.current = true;
          setFast(true);
        }

        // Keep it on while scrolling; clear shortly after stop.
        armClear();
      } catch {
        // ignore
      }
    };

    // Prime refs
    try {
      lastYRef.current = Number(window.scrollY || 0);
      lastTRef.current = now();
    } catch {}

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      try {
        window.removeEventListener("scroll", onScroll as any);
      } catch {}
      try {
        if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      } catch {}
      fastRef.current = false;
      setFast(false);
    };
  }, [depKey]);
}
