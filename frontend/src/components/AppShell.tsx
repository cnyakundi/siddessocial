"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";

import { AppTopBar } from "@/src/components/AppTopBar";
import { BottomNav } from "@/src/components/BottomNav";
import { MobileAirlockOverlay } from "@/src/components/MobileAirlockOverlay";
import { MobileSideTabsRow } from "@/src/components/MobileSideTabsRow";

import { DesktopAirlockOverlay } from "@/src/components/DesktopAirlockOverlay";
import { NotificationsDrawer } from "@/src/components/NotificationsDrawer";
import { DesktopSideDock } from "@/src/components/DesktopSideDock";
import { DesktopWorkspaceNav } from "@/src/components/DesktopWorkspaceNav";
import { DesktopTopBar } from "@/src/components/DesktopTopBar";
import { DesktopContextInspectorRail } from "@/src/components/DesktopContextInspectorRail";
import { PanicBanner } from "@/src/components/PanicBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
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

      

      <DesktopAirlockOverlay />{/* Mobile */}
      <div className="lg:hidden">
        <AppTopBar onOpenNotificationsDrawer={() => setNotifsOpen(true)} />
        {/* sd_523: Mobile Prism Side switch (physical 1-tap switching on core surfaces). */}
        <MobileSideTabsRow />
        <MobileAirlockOverlay />
        <NotificationsDrawer open={notifsOpen} onClose={() => setNotifsOpen(false)} />
        {/* sd_485: Side switching stays in the Airlock (SideBadge → SideSwitcherSheet) as a secondary path. */}
        {/* sd_494: BottomNav baseline padding (88px) + safe-area */}
        <div className="pb-[calc(88px+env(safe-area-inset-bottom))]">
          <div className="max-w-[430px] mx-auto">{children}</div>
        </div>
        <BottomNav />
      </div>

      {/* Desktop (Command Center) */}
      <div className={`hidden lg:grid w-full max-w-[1480px] mx-auto lg:grid-rows-[80px,1fr] lg:grid-cols-[80px,256px,minmax(0,760px)] ${inspectorExpanded ? "xl:grid-cols-[80px,256px,minmax(0,760px),360px]" : "xl:grid-cols-[80px,256px,minmax(0,760px),72px]"}`}>
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
        <div className="col-start-3 row-start-2 sd-min-h-shell bg-white border-x border-gray-100">
          <div>{children}</div>
        </div>

        {/* Right rail (xl-only) */}
        <div className="hidden xl:block col-start-4 row-start-2">
          <DesktopContextInspectorRail expanded={inspectorExpanded} onExpandedChange={setInspectorExpanded} />
        </div>
      </div>
    </div>
  );
}

