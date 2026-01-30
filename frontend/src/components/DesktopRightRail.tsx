"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDE_THEMES } from "@/src/lib/sides";
import { getCirclesProvider } from "@/src/lib/circlesProvider";
import type { CircleDef } from "@/src/lib/circles";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * DesktopRightRail
 * - xl-only (hidden below xl)
 * - Quiet utility widgets (not feed content)
 * - Keeps the center lane clean and distraction-free.
 *
 * sd_195: declutter + trust hygiene
 * - removed redundant right-rail search (DesktopTopBar already has search)
 * - removed placeholder "Context Health" panel
 * - removed dead Privacy/Terms links
 * - simplified set rows (no misleading plus button)
 */
export function DesktopRightRail() {
  // sd_213b_desktop_balance: width aligns with AppShell right column; offset below top bar

  const { side } = useSide();
  const theme = SIDE_THEMES[side];

  const setsProvider = useMemo(() => getCirclesProvider(), []);
  const [sets, setSets] = useState<CircleDef[]>([]);
  const [setsErr, setSetsErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSetsErr(null);

    setsProvider
      .list({ side })
      .then((items) => {
        if (!alive) return;
        setSets(Array.isArray(items) ? items.slice(0, 6) : []);
      })
      .catch((e) => {
        if (!alive) return;
        setSets([]);
        setSetsErr(String(e?.message || "Failed to load sets"));
      });

    return () => {
      alive = false;
    };
  }, [side, setsProvider]);

  return (
    <aside className="hidden xl:flex w-[360px] border-l border-gray-100 bg-white/80 backdrop-blur sticky top-20 h-[calc(100vh-80px)] overflow-y-auto" /* sd_212_right_rail_offset */>
      <div className="p-6 flex flex-col gap-6 w-full">
        {/* Sets (side-aware) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Sets</div>
            <Link
              href="/siddes-circles"
              className="text-xs font-bold text-gray-500 hover:text-gray-900 hover:underline"
              aria-label="Manage sets"
              title="Manage sets"
            >
              Manage
            </Link>
          </div>

          {setsErr ? (
            <div className="text-xs text-gray-500">Couldn't load sets.</div>
          ) : sets.length ? (
            <div className="space-y-3">
              {sets.map((s) => (
                <Link
                  key={s.id}
                  href={`/siddes-circles/${encodeURIComponent(String(s.id))}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center", theme.lightBg)}>
                    <Users size={16} className={theme.text} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{s.label}</div>
                    <div className="text-xs text-gray-500">{s.count ?? 0} members</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              No sets yet.{" "}
              <Link href="/siddes-circles" className="font-bold hover:underline">
                Create one
              </Link>
              .
            </div>
          )}
        </div>

        {/* Footer (no dead links) */}
        <div className="mt-auto pt-6 border-t border-gray-50 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/siddes-profile/account" className="hover:text-gray-600">
            Account
          </Link>
        </div>
      </div>
    </aside>
  );
}
