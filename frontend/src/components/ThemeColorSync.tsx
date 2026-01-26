"use client";

import { useEffect } from "react";
import type { SideId } from "@/src/lib/sides";
import { useSide } from "@/src/components/SideProvider";

// sd_736_theme_color_sync
// Keep the browser/PWA status bar color aligned to the active Side.
// This mainly improves Android Chrome + installed PWAs (theme-color meta).
const SIDE_THEME_COLOR: Record<SideId, string> = {
  public: "#2563EB", // tailwind blue-600
  friends: "#059669", // emerald-600
  close: "#E11D48", // rose-600
  work: "#334155", // slate-700
};

const FALLBACK = "#0B1020";

function setThemeColor(hex: string) {
  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]')) as HTMLMetaElement[];
  if (metas.length === 0) {
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = hex;
    document.head.appendChild(m);
    return;
  }
  metas.forEach((m) => m.setAttribute("content", hex));
}

export function ThemeColorSync() {
  const { side } = useSide();

  useEffect(() => {
    const hex = SIDE_THEME_COLOR[side] || FALLBACK;
    setThemeColor(hex);
  }, [side]);

  return null;
}
