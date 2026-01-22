"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { AppTopBar } from "@/src/components/AppTopBar";
import { BottomNav } from "@/src/components/BottomNav";

import { DesktopSideDock } from "@/src/components/DesktopSideDock";
import { DesktopWorkspaceNav } from "@/src/components/DesktopWorkspaceNav";
import { DesktopTopBar } from "@/src/components/DesktopTopBar";
import { DesktopRightRail } from "@/src/components/DesktopRightRail";

import { PanicBanner } from "@/src/components/PanicBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";

  const CHROME_HIDDEN_PREFIXES = [
    "/login",
    "/signup",
    "/onboarding",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/confirm-email-change",
    "/confirm-delete",
    "/account-deletion",
    "/terms",
    "/privacy",
    "/legal",
    "/community-guidelines",
    "/about",
  ];

  const hideChrome = CHROME_HIDDEN_PREFIXES.some((pre) => pathname.startsWith(pre));

  if (hideChrome) {
    return <div className="min-h-dvh bg-[#F8F9FA] text-gray-900">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-[#F8F9FA] text-gray-900">
      <PanicBanner />

      {/* Mobile */}
      <div className="lg:hidden">
        <AppTopBar />
        {/* sd_485: Side switching stays in the Airlock (SideBadge → SideSwitcherSheet). Keep mobile chrome minimal. */}
        {/* sd_494: BottomNav baseline padding (88px) + safe-area */}
        <div className="pb-[calc(88px+env(safe-area-inset-bottom))]">{children}</div>
        <BottomNav />
      </div>

      {/* Desktop (Command Center) */}
      <div className="hidden lg:grid w-full max-w-[1480px] mx-auto lg:grid-rows-[80px,1fr] lg:grid-cols-[80px,256px,minmax(0,760px)] xl:grid-cols-[80px,256px,minmax(0,760px),360px]">
        {/* Side dock (threshold controls) */}
        <div className="row-span-2">
          <DesktopSideDock />
        </div>

        {/* Workspace nav */}
        <div className="row-span-2 col-start-2">
          <DesktopWorkspaceNav />
        </div>

        {/* Topbar spans center (+ right on xl) */}
        <div className="col-start-3 col-span-1 xl:col-span-2">
          <DesktopTopBar />
        </div>

        {/* Center lane */}
        <div className="col-start-3 row-start-2 min-h-[calc(100vh-56px)] bg-white border-x border-gray-100">
          <div>{children}</div>
        </div>

        {/* Right rail (xl-only) */}
        <div className="hidden xl:block col-start-4 row-start-2">
          <DesktopRightRail />
        </div>
      </div>
    </div>
  );
}

