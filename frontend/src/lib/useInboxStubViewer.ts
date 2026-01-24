"use client";

import { useCallback, useEffect, useState } from "react";
import { getStubViewerCookie } from "@/src/lib/stubViewerClient";

/**
 * useInboxStubViewer
 *
 * Dev-only convenience hook: reads/writes the sd_viewer cookie used by
 * our stub inbox routes. Production builds ignore sd_viewer server-side;
 * this hook also becomes a read-only no-op in production.
 */

function sanitizeViewer(input: string): string {
  const raw = String(input || "").trim().slice(0, 64);
  if (!raw) return "";
  // allow simple ids like "me", "me_1", "alice", "bob-2".
  const safe = raw.replace(/[^a-zA-Z0-9_\-]/g, "");
  return safe;
}

function setCookie(name: string, value: string) {
  try {
    if (typeof document === "undefined") return;
    if (!value) {
      document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
      return;
    }
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
}

export function useInboxStubViewer(): [string, (v: string) => void] {
  const [viewer, setViewerState] = useState<string>(() => {
    const c = getStubViewerCookie();
    return sanitizeViewer(c || "me") || "me";
  });

  // keep in sync if something else sets the cookie (rare, but safe)
  useEffect(() => {
    const c = sanitizeViewer(getStubViewerCookie() || "");
    if (c && c !== viewer) setViewerState(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setViewer = useCallback((next: string) => {
    const v = sanitizeViewer(next) || "me";
    setViewerState(v);

    // Never write cookies in production.
    if (process.env.NODE_ENV === "production") return;

    setCookie("sd_viewer", v);
  }, []);

  return [viewer, setViewer];
}
