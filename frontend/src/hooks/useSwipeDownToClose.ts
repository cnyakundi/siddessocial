"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "pulling" | "armed" | "closing";

type Opts = {
  enabled: boolean;
  onClose: () => void;
  canStart?: () => boolean;
  thresholdPx?: number;
};

/**
 * sd_915_swipe_close_post_detail
 * Swipe down at top → release to close.
 * - Only engages when window.scrollY <= 0.
 * - Avoids starting on interactive elements (inputs/buttons/links).
 * - Ref-safe: onClose/canStart stored in refs.
 */
export function useSwipeDownToClose(opts: Opts) {
  const enabled = Boolean(opts.enabled);
  const THRESH = typeof opts.thresholdPx === "number" ? opts.thresholdPx : 84;

  const [pullY, setPullY] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  const pullYRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const activeRef = useRef(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);

  const onCloseRef = useRef(opts.onClose);
  const canStartRef = useRef(opts.canStart);
  const threshRef = useRef(THRESH);

  useEffect(() => { onCloseRef.current = opts.onClose; }, [opts.onClose]);
  useEffect(() => { canStartRef.current = opts.canStart; }, [opts.canStart]);
  useEffect(() => { threshRef.current = THRESH; }, [THRESH]);

  const setPhaseSafe = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const setPullYSafe = (y: number) => {
    pullYRef.current = y;
    setPullY(y);
  };

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const isInteractiveTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      try {
        return Boolean(el.closest("input, textarea, select, button, a, [role='button'], [data-no-swipeclose]"));
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
      // gentle resistance (native-ish)
      const capped = Math.min(220, Math.max(0, dy));
      return Math.round(capped * 0.55);
    };

    const begin = (e: TouchEvent) => {
      if (!enabled) return;
      if (!atTop()) return;
      if (phaseRef.current === "closing") return;
      if (e.touches && e.touches.length !== 1) return;
      if (isInteractiveTarget(e.target)) return;

      const fn = canStartRef.current;
      if (typeof fn === "function") {
        try { if (!fn()) return; } catch {}
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

      // more horizontal than vertical → abort
      if (Math.abs(dxRaw) > Math.abs(dyRaw) * 1.2) {
        activeRef.current = false;
        setPhaseSafe("idle");
        setPullYSafe(0);
        return;
      }

      if (dyRaw <= 0) {
        setPhaseSafe("idle");
        setPullYSafe(0);
        return;
      }

      if (!atTop()) return;

      // stop overscroll bounce while pulling
      try { e.preventDefault(); } catch {}

      const y = damp(dyRaw);
      setPullYSafe(y);

      if (y >= (threshRef.current || 84)) setPhaseSafe("armed");
      else setPhaseSafe("pulling");
    };

    const end = () => {
      if (!activeRef.current) return;
      activeRef.current = false;

      const y = pullYRef.current || 0;
      const isArmed = phaseRef.current === "armed" || y >= (threshRef.current || 84);

      if (isArmed) {
        setPhaseSafe("closing");
        // tiny extra nudge so it feels like it “commits”
        setPullYSafe(Math.max(120, y));

        // allow paint to commit, then close
        window.setTimeout(() => {
          try { onCloseRef.current?.(); } catch {}
        }, 40);
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
  }, [enabled]);

  return { pullY, phase };
}
