"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AppTopBar } from "@/src/components/AppTopBar";
import { MobileSideTabsRow } from "@/src/components/MobileSideTabsRow";
import { BottomNav } from "@/src/components/BottomNav";
import { DesktopSideRail } from "@/src/components/DesktopSideRail";
import { DesktopTopBar } from "@/src/components/DesktopTopBar";
import { DesktopRightRail } from "@/src/components/DesktopRightRail";
import { PanicBanner } from "@/src/components/PanicBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/about");

  if (hideChrome) {
    return <div className="min-h-dvh bg-gray-50 text-gray-900">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900">
      <PanicBanner />
      {/* Mobile */}
      <div className="lg:hidden">
        <AppTopBar />
        <MobileSideTabsRow />
        {/* sd_390: exact BottomNav padding (64px) + safe-area */}
        <div className="pb-24 pb-[calc(64px+env(safe-area-inset-bottom))]">{children}</div>
        <BottomNav />
      </div>

      {/* Desktop */}
      {/*
        Layout contract:
        - md..lg: slim left rail (96px) + fluid center
        - xl+:    wide left rail (360px) + fixed center (760px) + right rail (360px)
      */}
      <div className="hidden lg:grid w-full max-w-[1480px] mx-auto px-4 lg:px-6 md:grid-rows-[56px,1fr] md:grid-cols-[96px,minmax(0,1fr)] lg:grid-cols-[320px,minmax(0,760px)] xl:grid-cols-[360px,minmax(0,760px),360px]">
        {/* Left rail spans topbar row + content row */}
        <div className="row-span-2">
          <DesktopSideRail />
        </div>

        {/* Topbar spans center (+ right on xl) */}
        <div className="col-start-2 col-span-1 xl:col-span-2">
          <DesktopTopBar />
        </div>

        {/* Center lane */}
        <div className="col-start-2 row-start-2 min-h-[calc(100vh-56px)] bg-white md:border-x border-gray-100">
          <div>{children}</div>
        </div>

        {/* Right rail (xl-only) */}
        <div className="hidden xl:block col-start-3 row-start-2">
          <DesktopRightRail />
        </div>
      </div>
    </div>
  );
}
