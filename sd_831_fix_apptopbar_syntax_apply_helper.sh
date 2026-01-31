#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_831_fix_apptopbar_syntax"
echo "== ${SD_ID} =="

find_repo_root() {
  local d="$PWD"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/frontend" ]] && [[ -d "$d/backend" ]] && [[ -d "$d/scripts" ]]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [[ -z "${ROOT:-}" ]]; then
  echo "ERROR: Run from inside the repo (must contain ./frontend ./backend ./scripts)." >&2
  echo "Tip: cd /Users/cn/Downloads/sidesroot" >&2
  exit 1
fi

cd "$ROOT"

FILE="frontend/src/components/AppTopBar.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "ERROR: Missing $FILE" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "${BK}/$(dirname "$FILE")"
cp -a "$FILE" "${BK}/${FILE}"

cat > "$FILE" <<'EOF'
"use client";

// sd_831_fix_apptopbar_syntax
// Purpose: restore a compile-safe AppTopBar after accidental JSX splice/copy mistakes.

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, ChevronDown, RefreshCw, Search as SearchIcon, Lock as LockIcon } from "lucide-react";

import { SideSwitcherSheet } from "@/src/components/SideSwitcherSheet";
import { CirclePickerSheet } from "@/src/components/CirclePickerSheet";

import { useSide } from "@/src/components/SideProvider";
import { useSideActivity } from "@/src/hooks/useSideActivity";
import { useNotificationsActivity } from "@/src/hooks/useNotificationsActivity";
import { useSmartBack } from "@/src/hooks/useSmartBack";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import type { CircleDef, CircleId } from "@/src/lib/circles";
import { getCirclesProvider } from "@/src/lib/circlesProvider";
import {
  emitAudienceChanged,
  getStoredLastSetForSide,
  setStoredLastSetForSide,
  subscribeAudienceChanged,
} from "@/src/lib/audienceStore";
import { emitAppRefresh } from "@/src/lib/refreshBus"; // sd_746_pwa_refresh

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * AppTopBar (Mobile) — MVP Utility Header
 * - One header layer only (no stacked bars).
 * - Left: Side chip (Wearing label) → opens SideSwitcherSheet.
 * - Right: Calm title + small utility icons (refresh gated).
 */
export function AppTopBar(props: { onOpenNotificationsDrawer?: () => void } = {}) {
  const { onOpenNotificationsDrawer } = props;

  const pathname = usePathname() || "/";
  const router = useRouter(); // sd_746_pwa_refresh
  const { side, setSide, sideLock } = useSide();
  const theme = SIDE_THEMES[side];
  const activity = useSideActivity(side);
  const lockedSide = Boolean(sideLock?.enabled);
  const { unread } = useNotificationsActivity();

  // sd_831_refresh_gated: keep refresh out of production chrome (reduces clutter).
  const showRefresh = process.env.NODE_ENV !== "production";

  const isSiddes = pathname.startsWith("/siddes-");
  const isAppSurface =
    isSiddes || pathname.startsWith("/u/") || pathname.startsWith("/me") || pathname.startsWith("/search");

  const isNow = pathname === "/siddes-feed" || pathname.startsWith("/siddes-feed/");

  // Set scope is currently off in AppTopBar; SideFeed owns CircleFilterBar.
  const showSetScope = false;

  const isRootSurface =
    pathname === "/siddes-feed" ||
    pathname === "/siddes-inbox" ||
    pathname === "/siddes-circles" ||
    pathname === "/siddes-sets" ||
    pathname === "/siddes-search" ||
    pathname === "/search" ||
    pathname === "/siddes-notifications" ||
    pathname === "/siddes-profile" ||
    pathname === "/me";

  const showBack = isAppSurface && !isRootSurface;
  const goBack = useSmartBack("/siddes-feed");

  const pageTitle = useMemo(() => {
    if (!isAppSurface) return "";
    if (isNow) return "";
    if (pathname.startsWith("/siddes-post/")) return "Post";
    if (pathname.startsWith("/u/")) return "Profile";
    if (pathname.startsWith("/me")) return "Me";
    if (pathname.startsWith("/siddes-circles") || pathname.startsWith("/siddes-sets")) return "Circles";
    if (pathname.startsWith("/siddes-inbox")) return "Inbox";
    if (pathname.startsWith("/siddes-profile/prism")) return "Identity";
    if (pathname.startsWith("/siddes-profile/account")) return "Account";
    if (pathname.startsWith("/siddes-profile/people")) return "People";
    if (pathname.startsWith("/siddes-search") || pathname.startsWith("/search")) return "Search";
    if (pathname.startsWith("/siddes-profile")) return "Me";
    if (pathname.startsWith("/siddes-compose")) return "Create";
    if (pathname.startsWith("/siddes-notifications")) return "Alerts";
    return "";
  }, [isAppSurface, isNow, pathname]);

  const [sideSheetOpen, setSideSheetOpen] = useState(false);

  // Circle scope (private sides only)
  const [setSheetOpen, setSetSheetOpen] = useState(false);
  const [sets, setSets] = useState<CircleDef[]>([]);
  const [activeSet, setActiveSet] = useState<CircleId | null>(null);

  // Load circles for current side (best-effort)
  useEffect(() => {
    let cancelled = false;

    if (side === "public") {
      setSets([]);
      setActiveSet(null);
      return;
    }

    // Restore last scope immediately (fast)
    const last = getStoredLastSetForSide(side);
    setActiveSet(last || null);

    getCirclesProvider()
      .list({ side })
      .then((list) => {
        if (cancelled) return;
        const filtered = Array.isArray(list) ? list.filter((s) => s.side === side) : [];
        setSets(filtered);

        // If localStorage had a stale circleId for this Side, clear it.
        try {
          if (last && !filtered.some((x) => x.id === last)) {
            setActiveSet(null);
            setStoredLastSetForSide(side, null);
            emitAudienceChanged({ side, setId: null, topic: null, source: "AppTopBar" });
          }
        } catch {}
      })
      .catch(() => {
        if (cancelled) return;
        setSets([]);
      });

    return () => {
      cancelled = true;
    };
  }, [side]);

  // Follow along with global scope changes (e.g., other surfaces)
  useEffect(() => {
    return subscribeAudienceChanged((evt) => {
      if (!evt || evt.side !== side) return;
      if (side === "public") return;
      setActiveSet((evt.setId as any) || null);
    });
  }, [side]);

  const activeSetLabel = useMemo(() => {
    if (side === "public") return "All";
    if (!activeSet) return SIDES[side].label;
    const s = sets.find((x) => x.id === activeSet);
    return s ? s.label : SIDES[side].label;
  }, [activeSet, sets, side]);

  const canPickSet = showSetScope && side !== "public";

  const openAlerts = () => {
    try {
      if (onOpenNotificationsDrawer) {
        onOpenNotificationsDrawer();
        return;
      }
    } catch {}
    router.push("/siddes-notifications");
  };

  return (
    <div className="sticky top-0 z-[90] bg-white border-b border-gray-50 pt-[env(safe-area-inset-top)] relative">
      <div className={cn("absolute left-0 right-0 bottom-0 h-[3px]", theme.primaryBg)} aria-hidden />

      <div className="max-w-[430px] mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Left: Brand + Side */}
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              title="Back"
              className="w-9 h-9 rounded-xl bg-gray-900 text-white font-black text-lg flex items-center justify-center shadow-sm hover:opacity-95 active:scale-[0.98] transition"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
          ) : (
            <Link
              href="/siddes-feed"
              aria-label="Home"
              title="Home"
              className="w-9 h-9 rounded-xl bg-gray-900 text-white font-black text-lg flex items-center justify-center shadow-sm hover:opacity-95 active:scale-[0.98] transition"
            >
              S
            </Link>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                // Opening Side closes Circle picker (avoid double sheets)
                setSetSheetOpen(false);
                setSideSheetOpen(true);
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full",
                "bg-gray-50 hover:bg-gray-100 transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
              )}
              aria-label="Change Side"
              title="Change Side"
            >
              <span className="flex flex-col leading-none">
                <span className="text-[8px] font-black uppercase tracking-[0.22em] text-gray-400">Wearing</span>
                <span className="mt-1 flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full", theme.primaryBg)} aria-hidden />
                  <span className="text-[12px] font-black tracking-tight text-gray-900">{SIDES[side].label}</span>
                  {lockedSide ? <LockIcon size={12} className="text-gray-300" aria-hidden /> : null}
                </span>
              </span>
              <ChevronDown size={14} className="text-gray-400" aria-hidden />
            </button>
          </div>
        </div>

        {/* Right: Title + utilities */}
        <div className="flex items-center justify-end min-w-0 gap-2">
          {showSetScope ? (
            canPickSet ? (
              <button
                type="button"
                onClick={() => setSetSheetOpen(true)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-full",
                  "bg-gray-50 hover:bg-gray-100 transition-colors",
                  "text-sm font-extrabold text-gray-700",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
                )}
                aria-label="Choose circle"
                title="Choose circle"
              >
                <span className="truncate max-w-[180px]">{activeSetLabel}</span>
                <ChevronDown size={14} className="text-gray-400" aria-hidden />
              </button>
            ) : (
              <div className="px-3 py-2 rounded-full bg-gray-50 text-sm font-extrabold text-gray-400 select-none">All</div>
            )
          ) : pageTitle ? (
            <div className="text-sm font-semibold text-gray-700 pr-1 select-none">{pageTitle}</div>
          ) : (
            <div />
          )}

          {showRefresh ? (
            <button
              type="button"
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-full hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
              aria-label="Refresh"
              title="Refresh"
              onClick={() => {
                try {
                  emitAppRefresh("topbar");
                } catch {}
                try {
                  router.refresh();
                } catch {}
              }}
            >
              <RefreshCw size={18} className="text-gray-500" aria-hidden />
            </button>
          ) : null}

          <button
            type="button"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-full hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
            aria-label="Alerts"
            title="Alerts"
            onClick={openAlerts}
          >
            <span className="relative">
              <Bell size={18} className="text-gray-500" aria-hidden />
              {unread > 0 ? (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white"
                  aria-label="New notifications"
                />
              ) : null}
            </span>
          </button>

          <Link
            href="/siddes-search"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-full hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
            aria-label="Search"
            title="Search"
          >
            <SearchIcon size={18} className="text-gray-500" aria-hidden />
          </Link>
        </div>
      </div>

      {/* Side picker */}
      <SideSwitcherSheet
        open={sideSheetOpen}
        onClose={() => setSideSheetOpen(false)}
        currentSide={side}
        activity={activity}
        onSwitch={(nextSide) => {
          // Switching Side resets scope to last-known circle (or All).
          setSide(nextSide);
          setSideSheetOpen(false);

          if (nextSide !== "public") {
            const last = getStoredLastSetForSide(nextSide);
            setActiveSet(last || null);
            emitAudienceChanged({ side: nextSide, setId: last || null, topic: null, source: "AppTopBar" });
          } else {
            setActiveSet(null);
            emitAudienceChanged({ side: nextSide, setId: null, topic: null, source: "AppTopBar" });
          }
        }}
      />

      {/* Circle picker (private sides only) */}
      {canPickSet ? (
        <CirclePickerSheet
          open={setSheetOpen}
          currentSide={side}
          onClose={() => setSetSheetOpen(false)}
          sets={sets}
          activeSet={activeSet}
          onPick={(next) => {
            setActiveSet(next);
            setStoredLastSetForSide(side, next);
            emitAudienceChanged({ side, setId: next, topic: null, source: "AppTopBar" });
          }}
          title="Circle"
          allLabel={SIDES[side].label}
        />
      ) : null}
    </div>
  );
}
EOF

echo "✅ Patched: $FILE"
echo "Backup: $BK"
echo ""
echo "Next (VS Code terminal):"
echo "  cd \"$ROOT\""
echo "  cd frontend && npm run typecheck"
echo "  npm run build"
echo ""
echo "Smoke:"
echo "  - Open any /siddes-* page: top bar renders"
echo "  - Tap Side chip: sheet opens"
echo "  - Tap Alerts bell: drawer or /siddes-notifications"
