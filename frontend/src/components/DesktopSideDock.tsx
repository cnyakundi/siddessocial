"use client";

import React from "react";
import Link from "next/link";
import { Globe, Users, Lock, Briefcase, Settings } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_ORDER, SIDE_THEMES, type SideId } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const ICONS: Record<SideId, React.ComponentType<any>> = {
  public: Globe,
  friends: Users,
  close: Lock,
  work: Briefcase,
};

/**
 * DesktopSideDock (Lane 1: Threshold Rail — 80px)
 * Measurement Protocol v1.2:
 * - Header baseline: 80px (h-20)
 * - Brand box: 44x44 (w-11 h-11) radius 12 (rounded-xl)
 * - Side tabs: 56x56 (w-14 h-14) radius 16 (rounded-2xl)
 * - Gap between tabs: 24px (gap-6)
 * - Active indicator: 1.5px bar on far-left edge of rail
 */
export function DesktopSideDock() {
  const { side, setSide } = useSide();

  return (
    <aside className="h-screen sticky top-0 bg-white border-r border-gray-100 flex flex-col items-center">
      {/* Baseline header (80px) */}
      <div className="h-20 flex items-center justify-center">
        <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg select-none">
          S
        </div>
      </div>

      {/* Side switcher */}
      <nav aria-label="Context switcher" className="flex flex-col items-center gap-6 py-8 w-full">
        {SIDE_ORDER.map((id) => {
          const meta = SIDES[id];
          const t = SIDE_THEMES[id];
          const Icon = ICONS[id];
          const isActive = id === side;

          return (
            <div key={id} className="relative w-full flex justify-center">
              {isActive ? (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[1.5px] h-8 bg-gray-900 rounded-r-full" />
              ) : null}

              <button
                type="button"
                onClick={() => setSide(id)}
                aria-label={`${meta.label} Side`}
                aria-current={isActive ? "page" : undefined}
                title={`${meta.label} Side`}
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 relative group",
                  isActive ? cn(t.primaryBg, "text-white shadow-lg scale-110") : "bg-white text-gray-400 hover:bg-gray-50"
                )}
              >
                <Icon size={24} strokeWidth={2.5} fill={isActive ? "currentColor" : "none"} />
                {/* Tooltip */}
                <div className="absolute left-16 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  {meta.label} Side
                </div>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Bottom utilities */}
      <div className="mt-auto pb-8 flex flex-col items-center gap-6 text-gray-300">
        <Link
          href="/siddes-settings"
          aria-label="Settings"
          title="Settings"
          className="w-12 h-12 rounded-xl flex items-center justify-center hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Settings size={24} strokeWidth={2.5} />
        </Link>
      </div>
    </aside>
  );
}