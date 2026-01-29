"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "pulling" | "armed" | "refreshing";

type Opts = {
  enabled: boolean;
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
  canStart?: () => boolean;
  thresholdPx?: number;
};

/**
 * sd_913_pull_to_refresh_refsafe
 * Finger drag down at top → release to refresh.
 *
 * Key safety:
 * - Stores onRefresh/canStart in refs so callbacks never go stale across renders (Side changes, filters, etc).
 * - Tracks pullY in a ref so touchend uses the real latest distance.
 */
export function usePullToRefresh(opts: Opts) {
  const enabled = Boolean(opts.enabled);
  const externalRefreshing = Boolean(opts.refreshing);
  const THRESH = typeof opts.thresholdPx === "number" ? opts.thresholdPx : 64;

  const [pullY, setPullY] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  const pullYRef = useRef(0);
  const activeRef = useRef(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);

  const phaseRef = useRef<Phase>("idle");
  const onRefreshRef = useRef(opts.onRefresh);
  const canStartRef = useRef(opts.canStart);
  const threshRef = useRef(THRESH);

  useEffect(() => {
    onRefreshRef.current = opts.onRefresh;
  }, [opts.onRefresh]);

  useEffect(() => {
    canStartRef.current = opts.canStart;
  }, [opts.canStart]);

  useEffect(() => {
    threshRef.current = THRESH;
  }, [THRESH]);

  const setPhaseSafe = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const setPullYSafe = (y: number) => {
    pullYRef.current = y;
    setPullY(y);
  };

  // When the caller’s refresh completes, release the pull.
  useEffect(() => {
    if (phaseRef.current !== "refreshing") return;
    if (externalRefreshing) return;
    setPhaseSafe("idle");
    setPullYSafe(0);
  }, [externalRefreshing]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const isInteractiveTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      try {
        return Boolean(el.closest("input, textarea, select, button, a, [role='button'], [data-no-pull]"));
      } catch {
        return false;
      }
    };

    const atTop = () => {
      try {
        return (window.scrollY || 0) <= 0;
      } catch {
        return true;
      }
    };

    const damp = (dy: number) => {
      const capped = Math.min(140, Math.max(0, dy));
      return Math.round(capped * 0.55);
    };

    const begin = (e: TouchEvent) => {
      if (!enabled) return;
      if (phaseRef.current === "refreshing") return;
      if (externalRefreshing) return;
      if (!atTop()) return;
      if (e.touches && e.touches.length !== 1) return;
      if (isInteractiveTarget(e.target)) return;

      const fn = canStartRef.current;
      if (typeof fn === "function") {
        try {
          if (!fn()) return;
        } catch {}
      }

      const t = e.touches[0];
      activeRef.current = true;
      startYRef.current = t.clientY;
      startXRef.current = t.clientX;
      setPhaseSafe("pulling");
      setPullYSafe(0);
    };

    const move = (e: TouchEvent) => {
      if (!activeRef.current) return;
      if (e.touches && e.touches.length !== 1) return;

      const t = e.touches[0];
      const dyRaw = t.clientY - startYRef.current;
      const dxRaw = t.clientX - startXRef.current;

      // If it’s more horizontal than vertical, abort.
      if (Math.abs(dxRaw) > Math.abs(dyRaw) * 1.2) {
        activeRef.current = false;
        setPullYSafe(0);
        setPhaseSafe("idle");
        return;
      }

      if (dyRaw <= 0) {
        setPullYSafe(0);
        setPhaseSafe("idle");
        return;
      }

      if (!atTop()) return;

      // Stop default overscroll bounce.
      try {
        e.preventDefault();
      } catch {}

      const y = damp(dyRaw);
      setPullYSafe(y);

      if (y >= (threshRef.current || 64)) setPhaseSafe("armed");
      else setPhaseSafe("pulling");
    };

    const end = async () => {
      if (!activeRef.current) return;
      activeRef.current = false;

      const y = pullYRef.current || 0;
      const isArmed = phaseRef.current === "armed" || y >= (threshRef.current || 64);

      if (isArmed && !externalRefreshing) {
        setPhaseSafe("refreshing");
        setPullYSafe(52);
        try {
          await Promise.resolve(onRefreshRef.current?.());
        } catch {
          setPhaseSafe("idle");
          setPullYSafe(0);
        }
        return;
      }

      setPhaseSafe("idle");
      setPullYSafe(0);
    };

    window.addEventListener("touchstart", begin, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });

    return () => {
      window.removeEventListener("touchstart", begin as any);
      window.removeEventListener("touchmove", move as any);
      window.removeEventListener("touchend", end as any);
      window.removeEventListener("touchcancel", end as any);
    };
  }, [enabled, externalRefreshing]);

  return { pullY, phase };
}
