"use client";

import { useEffect, useState } from "react";

const LS_VIEWER = "sd_inbox_stub_viewer";
const COOKIE = "sd_viewer";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const raw = String(document.cookie || "");
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf("=");
    if (i < 0) continue;
    const k = p.slice(0, i).trim();
    if (k !== name) continue;
    return decodeURIComponent(p.slice(i + 1));
  }
  return null;
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  // 30 days, Lax, root path.
  const v = encodeURIComponent(String(value || ""));
  document.cookie = `${name}=${v}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * DEV-only stub viewer selector.
 * - Source of truth: sd_viewer cookie (used by Next proxy routes for x-sd-viewer in DEBUG)
 * - Mirrors to localStorage for convenience.
 * - NEVER uses URL query params.
 */
export function useInboxStubViewer(): [string, (v: string) => void] {
  const [viewer, setViewer] = useState("");

  useEffect(() => {
    try {
      const c = getCookie(COOKIE);
      if (c) {
        setViewer(String(c));
        return;
      }
    } catch {}

    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(LS_VIEWER);
        if (raw != null) setViewer(String(raw));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LS_VIEWER, viewer);
      }
    } catch {}

    const v = String(viewer || "").trim();
    if (v) setCookie(COOKIE, v);
    else clearCookie(COOKIE);
  }, [viewer]);

  return [viewer, setViewer];
}
