"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Globe, Users, Lock, Briefcase, type LucideIcon } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";

const SIDE_MEANING: Record<SideId, string> = {
  public: "Everyone",
  friends: "My friends",
  close: "Only close people",
  work: "Work people",
};

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  close: Lock,
  work: Briefcase,
};

/**
 * sd_466a: Dead-simple, always-visible Side tabs row (mobile/tablet).
 * Shows on high-level index pages only:
 * - /siddes-feed
 * - /siddes-sets
 *
 * Uses SideProvider's gateway (Public requires confirm).
 */
export function MobileSideTabsRow() {
  const pathname = usePathname() || "";
  const show = pathname === "/siddes-feed" || pathname === "/siddes-sets";
  const { side, setSide } = useSide();

  if (!show) return null;

  return (
    <div
      className="sticky z-[85] bg-white/95 backdrop-blur border-b border-gray-100"
      style={{ top: "calc(env(safe-area-inset-top) + 56px)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {SIDE_ORDER.map((id) => {
            const theme = SIDE_THEMES[id];
            const Icon = SIDE_ICON[id];
            const isActive = side === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setSide(id)}
                className={[
                  "flex flex-col items-start justify-center gap-0.5 px-3 py-2 rounded-2xl border transition-all whitespace-nowrap min-w-[112px]",
                  isActive
                    ? `${theme.lightBg} ${theme.border} ${theme.text} shadow-sm`
                    : "bg-white border-gray-100 text-gray-500 hover:border-gray-200",
                  "active:scale-95",
                ].join(" ")}
                aria-label={`Switch to ${SIDES[id].label}`}
                title={SIDES[id].privacyHint}
              >
                <span className="flex items-center gap-2">
                  <Icon size={12} strokeWidth={3} />
                  <span className="text-[11px] font-bold uppercase tracking-tight">{SIDES[id].label}</span>
                </span>

                {isActive ? (
                  <span className="text-[10px] font-medium leading-none text-gray-600">{SIDE_MEANING[id]}</span>
                ) : (
                  <span className="sr-only">{SIDE_MEANING[id]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
