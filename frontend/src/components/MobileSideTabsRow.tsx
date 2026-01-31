"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Lock as LockIcon } from "lucide-react";

import { useSide } from "@/src/components/SideProvider";
import { SIDES, type SideId } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * MobileSideTabsRow — Design Canon (Rooms) v1
 * - Segmented control (RoomSwitcher) shown on /siddes-feed only.
 * - Uses SideProvider gateway (Public-entry confirm) and respects route SideLock.
 * - Color map matches Siddes themes:
 *   Public=Blue, Friends=Emerald, Close=Rose, Work=Slate.
 */
const ACTIVE: Record<SideId, string> = {
  public: "bg-blue-50 text-blue-700 shadow-sm border-blue-100 ring-1 ring-blue-100",
  friends: "bg-emerald-50 text-emerald-700 shadow-sm border-emerald-100 ring-1 ring-emerald-100",
  close: "bg-rose-50 text-rose-700 shadow-sm border-rose-100 ring-1 ring-rose-100",
  work: "bg-slate-50 text-slate-700 shadow-sm border-slate-100 ring-1 ring-slate-100",
};

const ORDER: SideId[] = ["public", "friends", "close", "work"];

export function MobileSideTabsRow() {
  const pathname = usePathname() || "";
  const show = pathname === "/siddes-feed" || pathname.startsWith("/siddes-feed/");
  const { side, setSide, sideLock } = useSide();

  if (!show) return null;

  const lockedSide = sideLock?.enabled ? (sideLock.side as SideId | null) : null;
  const lockReason = sideLock?.enabled ? sideLock.reason : null;
  const lockReasonLabel = lockReason ? String(lockReason) : null;

  return (
    <div
      className="sticky z-[89] bg-white/90 backdrop-blur border-b border-gray-50"
      // AppTopBar: pt(safe-area) + h-14 (56px)
      style={{ top: "calc(env(safe-area-inset-top) + 56px)" }}
      aria-label="Room switcher"
    >
      <div className="max-w-[430px] mx-auto px-4 py-2">
        <div className="flex w-full gap-2 p-1 bg-gray-50/80 rounded-xl border border-gray-100">
          {ORDER.map((id) => {
            const isActive = side === id;
            const allowed = !lockedSide || lockedSide === id;

            return (
              <button
                key={id}
                type="button"
                disabled={!allowed}
                onClick={() => {
                  if (!allowed) return;
                  setSide(id);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center py-2 rounded-lg",
                  "text-[10px] font-black uppercase tracking-wide",
                  "transition-all border",
                  isActive
                    ? ACTIVE[id]
                    : "text-gray-400 hover:text-gray-600 hover:bg-white/60 border-transparent",
                  !allowed ? "opacity-40 cursor-not-allowed" : null
                )}
                aria-current={isActive ? "page" : undefined}
                aria-disabled={!allowed}
                title={SIDES[id]?.privacyHint || SIDES[id]?.label || id}
              >
                <span className="truncate">{SIDES[id]?.label || id}</span>
              </button>
            );
          })}
        </div>

        {lockedSide ? (
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">
            <LockIcon size={12} strokeWidth={2.5} className="text-gray-300" aria-hidden />
            <span className="truncate">
              Locked to {SIDES[lockedSide]?.label || lockedSide}
              {lockReasonLabel ? ` • ${lockReasonLabel}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
