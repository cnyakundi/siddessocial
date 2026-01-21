"use client";

import { useEffect } from "react";

// Global ref-count so multiple overlays can lock without fighting.
let lockCount = 0;
let prevOverflow = "";
let prevPaddingRight = "";

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    if (typeof document === "undefined") return;

    lockCount += 1;

    if (lockCount === 1) {
      const body = document.body;
      prevOverflow = body.style.overflow;
      prevPaddingRight = body.style.paddingRight;

      // Avoid layout shift on desktop when scrollbar disappears.
      const sbw =
        typeof window !== "undefined"
          ? window.innerWidth - document.documentElement.clientWidth
          : 0;

      body.style.overflow = "hidden";
      if (sbw > 0) body.style.paddingRight = sbw + "px";
    }

    return () => {
      if (typeof document === "undefined") return;
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        const body = document.body;
        body.style.overflow = prevOverflow;
        body.style.paddingRight = prevPaddingRight;
      }
    };
  }, [locked]);
}
