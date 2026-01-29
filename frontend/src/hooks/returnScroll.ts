"use client";

import { useEffect } from "react";

const KEY_PATH = "sd.return.path";
const KEY_Y = "sd.return.y";
const KEY_TS = "sd.return.ts";
const KEY_ANCHOR = "sd.return.anchor";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

function now() {
  return Date.now();
}

function getPath() {
  return window.location.pathname + window.location.search;
}

function clear() {
  try {
    window.sessionStorage.removeItem(KEY_PATH);
    window.sessionStorage.removeItem(KEY_Y);
    window.sessionStorage.removeItem(KEY_TS);
    window.sessionStorage.removeItem(KEY_ANCHOR);
  } catch {
    // ignore
  }
}

/**
 * Save return scroll position for list→detail flows.
 * Optionally pass an anchor postId to refine restoration (virtualized lists).
 */
export function saveReturnScroll(anchorPostId?: string) {
  if (typeof window === "undefined") return;
  try {
    const path = getPath();
    // Only capture list pages where restoring makes sense.
    const ok =
      path.startsWith("/siddes-feed") ||
      path.startsWith("/siddes-sets") ||
      path.startsWith("/siddes-inbox") ||
      path.startsWith("/siddes-search") ||
      path.startsWith("/u/") ||
      path.startsWith("/siddes-notifications") ||
      path.startsWith("/siddes-profile");
    // sd_719_fix_returnScroll_ok_guard: only capture list pages where restoring makes sense (avoid undefined ok)
    if (!ok) return;
    window.sessionStorage.setItem(KEY_PATH, path);
    window.sessionStorage.setItem(KEY_Y, String(Math.max(0, Math.round(window.scrollY || 0))));
    window.sessionStorage.setItem(KEY_TS, String(now()));
    if (anchorPostId) window.sessionStorage.setItem(KEY_ANCHOR, String(anchorPostId));
  } catch {
    // ignore
  }
}

function isNearViewport(el: Element) {
  try {
    const r = (el as HTMLElement).getBoundingClientRect();
    // Within a comfortable band (accounting for sticky top bars)
    const topSafe = 80;
    const bottomSafe = 120;
    return r.top >= topSafe && r.bottom <= (window.innerHeight - bottomSafe);
  } catch {
    return true;
  }
}

function tryAnchorScroll(anchor: string): boolean {
  try {
    const el = document.querySelector(`[data-post-id="${anchor}"]`);
    if (!el) return false;

    // If it’s already in a good spot, don’t jump.
    if (isNearViewport(el)) return true;

    (el as HTMLElement).scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    return true;
  } catch {
    return false;
  }
}

export function useReturnScrollRestore() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const path = getPath();
      const savedPath = window.sessionStorage.getItem(KEY_PATH);
      if (!savedPath || savedPath !== path) return;

      const ts = Number(window.sessionStorage.getItem(KEY_TS) || "0");
      if (!ts || now() - ts > MAX_AGE_MS) {
        clear();
        return;
      }

      const y = Number(window.sessionStorage.getItem(KEY_Y) || "0");
      const anchor = (window.sessionStorage.getItem(KEY_ANCHOR) || "").trim();

      // Clear first so we only run once.
      clear();

      const target = Math.max(0, Math.round(Number.isFinite(y) ? y : 0));
      const scrollToTarget = () => window.scrollTo({ top: target, left: 0, behavior: "auto" });

      // Defer to allow virtualizer/layout to settle.
      requestAnimationFrame(() => {
        scrollToTarget();
      });

      // Retry a couple times.
      window.setTimeout(scrollToTarget, 120);
      window.setTimeout(scrollToTarget, 260);

      // Anchor refinement (best-effort). This helps when dynamic modules shift content.
      if (anchor) {
        const attempts = [180, 360, 720, 1200];
        for (const ms of attempts) {
          window.setTimeout(() => {
            // Only adjust if we can actually find the element.
            tryAnchorScroll(anchor);
          }, ms);
        }
      }
    } catch {
      // ignore
    }
  }, []);
}
