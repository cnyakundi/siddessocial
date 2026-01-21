"use client";

import { useEffect } from "react";

const KEY_PATH = "sd.return.path";
const KEY_Y = "sd.return.y";
const KEY_TS = "sd.return.ts";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function saveReturnScroll() {
  if (typeof window === "undefined") return;
  try {
    const path = window.location.pathname + window.location.search;

    // Only capture list → detail flows where restoring makes sense.
    if (!path.startsWith("/siddes-feed") && !path.startsWith("/siddes-sets")) return;

    window.sessionStorage.setItem(KEY_PATH, path);
    window.sessionStorage.setItem(KEY_Y, String(Math.max(0, Math.round(window.scrollY || 0))));
    window.sessionStorage.setItem(KEY_TS, String(Date.now()));
  } catch {
    // ignore
  }
}

function clear() {
  try {
    window.sessionStorage.removeItem(KEY_PATH);
    window.sessionStorage.removeItem(KEY_Y);
    window.sessionStorage.removeItem(KEY_TS);
  } catch {
    // ignore
  }
}

export function useReturnScrollRestore() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const path = window.location.pathname + window.location.search;
      const savedPath = window.sessionStorage.getItem(KEY_PATH);
      if (!savedPath || savedPath !== path) return;

      const ts = Number(window.sessionStorage.getItem(KEY_TS) || "0");
      if (!ts || Date.now() - ts > MAX_AGE_MS) {
        clear();
        return;
      }

      const y = Number(window.sessionStorage.getItem(KEY_Y) || "0");
      if (!Number.isFinite(y)) {
        clear();
        return;
      }

      // Clear first so this only runs once per return.
      clear();

      const target = Math.max(0, Math.round(y));
      const tryScroll = () => window.scrollTo({ top: target, left: 0, behavior: "auto" });

      // Defer to allow layout/virtualizer to settle.
      requestAnimationFrame(() => {
        tryScroll();
        requestScroll();
      });

      function requestScroll() {
        requestAnimationFrame(() => {
          tryScroll();
        });
      }

      window.setTimeout(() => {
        if (Math.abs((window.scrollY || 0) - target) > 8) tryScroll();
      }, 220);
    } catch {
      // ignore
    }
  }, []);
}
