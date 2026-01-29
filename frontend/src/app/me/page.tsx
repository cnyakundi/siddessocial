"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/src/lib/authMe";

// sd_797: /me = "my profile with posts" (viewer-style profile), not the identity editor.
// - authed:  /u/:username
// - not authed: /siddes-profile (login prompt + identity tools)
export default function MePage() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    (async () => {
      const me = await fetchMe().catch(() => ({ ok: false, authenticated: false } as any));
      if (!alive) return;

      const username = String(me?.user?.username || "").trim();
      if (me?.authenticated && username) {
        router.replace(`/u/${encodeURIComponent(username)}`);
        return;
      }

      router.replace("/siddes-profile");
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  return <div className="p-4 text-xs text-gray-500">Loading…</div>;
}
