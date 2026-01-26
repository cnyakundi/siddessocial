"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Globe, Users, Heart, Lock, Briefcase, type LucideIcon } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  // sd_749_pwa_notifs_nav: Close = Inner Circle (Heart), not a "lock" (security is already conveyed elsewhere)
  close: Heart,
  work: Briefcase,
};

/**
 * sd_483: Threshold Habit (mobile)
 * Make Side switching physically fast:
 * - Always visible on the core surfaces (feed/sets/inbox/post detail)
 * - All 4 Sides visible at once (no horizontal scrolling)
 * - 44px+ hit targets (h-11) and instant color feedback
 * - No cross-side activity hints (prevents "side bleeding" signals)
 *
 * Uses SideProvider's gateway (entering Public requires confirm).
 * sd_523: SideLock-aware (threads/sets) + correct sticky offset below AppTopBar.
 */
export function MobileSideTabsRow() {
  const pathname = usePathname() || "";
      const show =
    pathname.startsWith("/siddes-") &&
    !pathname.startsWith("/siddes-compose");

  const { side, setSide, sideLock } = useSide();
  const lockedSide = sideLock?.enabled ? sideLock.side : null;
  const lockReason = sideLock?.enabled ? sideLock.reason : null;

  const lockReasonLabel =
    lockReason === "thread" ? "Thread" :
    lockReason === "set" ? "Set" :
    lockReason ? String(lockReason) :
    null;

  if (!show) return null;

  return (
    <div
      className="sticky z-[85] bg-white/95 backdrop-blur border-b border-gray-100"
      // AppTopBar: safe-area + h-16 (64px)
      style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}
      data-testid="side-tabs-row"
    >
      <div className="max-w-[430px] mx-auto px-4 py-2">
        <div className="grid grid-cols-4 gap-2">
          {SIDE_ORDER.map((id) => {
            const theme = SIDE_THEMES[id];
            const Icon = SIDE_ICON[id];
            const isActive = side === id;
            const allowed = !lockedSide || id === lockedSide;

            return (
              <button
                key={id}
                type="button"
                disabled={!allowed}
                onClick={() => {
                  if (!allowed) return;
                  setSide(id);
                }}
                aria-label={`Switch to ${SIDES[id].label}`}
                aria-current={isActive ? "page" : undefined}
                title={SIDES[id].privacyHint}
                className={cn(
                  "h-11 w-full rounded-2xl border px-2 flex items-center justify-center gap-2",
                  "text-[11px] font-extrabold uppercase tracking-tight transition",
                  "active:scale-95",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20",
                  !allowed ? "opacity-45 cursor-not-allowed" : null,
                  isActive
                    ? cn(theme.lightBg, theme.border, theme.text, "shadow-sm")
                    : "bg-white border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200"
                )}
              >
                <span className={cn("w-1.5 h-5 rounded-full", theme.primaryBg)} aria-hidden />
                <Icon size={14} strokeWidth={2.5} aria-hidden />
                <span className="truncate">{SIDES[id].label}</span>

                {!allowed ? (
                  <span
                    className="ml-auto -mr-1 w-5 h-5 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm"
                    title={lockReasonLabel ? `Locked (${lockReasonLabel})` : "Locked"}
                    aria-hidden
                  >
                    <Lock size={10} strokeWidth={2.5} className="text-gray-400" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {lockedSide ? (
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">
            <Lock size={12} strokeWidth={2.5} className="text-gray-300" aria-hidden />
            <span>
              Locked to {SIDES[lockedSide].label}
              {lockReasonLabel ? ` • ${lockReasonLabel}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
