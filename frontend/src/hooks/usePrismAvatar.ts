"use client";

import { useEffect, useState } from "react";
import type { SideId } from "@/src/lib/sides";

const CACHE_KEY = "__sd_prism_cache_v1";

function initialsFromName(nameOrHandle: string) {
  const s = String(nameOrHandle || "").replace(/^@/, "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return (parts[0][0] || "U").toUpperCase();
  return ((parts[0][0] || "U") + (parts[parts.length - 1][0] || "U")).toUpperCase();
}

function extractForSide(payload: any, side: SideId): { img: string | null; initials: string } {
  try {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const f = items.find((x: any) => x?.side === side) || null;
    const name = String(f?.displayName || payload?.user?.username || "You");
    const av = (f?.avatarImage && String(f.avatarImage).trim()) || "";
    return { img: av || null, initials: initialsFromName(name) };
  } catch {
    return { img: null, initials: "U" };
  }
}

export function usePrismAvatar(side: SideId): { img: string | null; initials: string } {
  const [img, setImg] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>("U");

  useEffect(() => {
    let cancelled = false;

    const apply = (j: any) => {
      const out = extractForSide(j, side);
      if (cancelled) return;
      setImg(out.img);
      setInitials(out.initials);
    };

    try {
      const raw = window.sessionStorage.getItem(CACHE_KEY);
      if (raw) apply(JSON.parse(raw));
    } catch {}

    fetch("/api/prism", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        try {
          window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(j));
        } catch {}
        apply(j);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [side]);

  return { img, initials };
}
