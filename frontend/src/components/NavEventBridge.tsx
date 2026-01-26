"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type NavDetail = { href: string; replace?: boolean };

export function NavEventBridge() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: any) => {
      const d = (e?.detail || {}) as NavDetail;
      const href = String(d.href || '').trim();
      if (!href) return;
      try {
        if (d.replace) router.replace(href);
        else router.push(href);
      } catch {
        // ignore
      }
    };
    window.addEventListener("sd:navigate", handler as any);
    return () => window.removeEventListener("sd:navigate", handler as any);
  }, [router]);

  return null;
}
