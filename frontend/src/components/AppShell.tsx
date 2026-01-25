"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";

import { AppTopBar } from "@/src/components/AppTopBar";
import { BottomNav } from "@/src/components/BottomNav";
import { MobileAirlockOverlay } from "@/src/components/MobileAirlockOverlay";

import { DesktopAirlockOverlay } from "@/src/components/DesktopAirlockOverlay";
import { NotificationsDrawer } from "@/src/components/NotificationsDrawer";
import { DesktopSideDock } from "@/src/components/DesktopSideDock";
import { DesktopTopBar } from "@/src/components/DesktopTopBar";
import { PanicBanner } from "@/src/components/PanicBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [notifsOpen, setNotifsOpen] = useState(false);
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
    "/p",
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
        <MobileAirlockOverlay />
        <NotificationsDrawer open={notifsOpen} onClose={() => setNotifsOpen(false)} />
        {/* sd_485: Side switching stays in the Airlock (SideBadge → SideSwitcherSheet) as a secondary path. */}
        {/* sd_494: BottomNav baseline padding (88px) + safe-area */}
        <div className="pb-[calc(88px+env(safe-area-inset-bottom))]">
          <div className="max-w-[430px] mx-auto">{children}</div>
        </div>
        <BottomNav />
      </div>

            {/* Desktop (MVP skeleton) */}
      <div className="hidden lg:flex w-full max-w-[1000px] mx-auto">
        <DesktopSideDock />
        <div className="flex-1 min-w-0">
          <DesktopTopBar />
          <div className="sd-min-h-shell bg-white border-r border-gray-100">
            <div className="mx-auto w-full max-w-[760px] px-6 pb-24">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

