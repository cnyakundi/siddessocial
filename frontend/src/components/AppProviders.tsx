"use client";

import React from "react";
import { SideProvider } from "@/src/components/SideProvider";
import { AppShell } from "@/src/components/AppShell";
import { FirstRunSidePicker } from "@/src/components/FirstRunSidePicker";
import { PwaClient } from "@/src/components/PwaClient";
import { AppBadgeClient } from "@/src/components/AppBadgeClient";
import { ThemeColorSync } from "@/src/components/ThemeColorSync";
import { QueueIndicator } from "@/src/components/QueueIndicator";
import { StubViewerCookie } from "@/src/components/StubViewerCookie";
import { ToastHost } from "@/src/components/ToastHost";
import { AuthBootstrap } from "@/src/components/AuthBootstrap";
import { NavEventBridge } from "@/src/components/NavEventBridge";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SideProvider>

      <ThemeColorSync />
<FirstRunSidePicker />
      <NavEventBridge />
      <AuthBootstrap />

      {/* Reserve space for BottomNav (and iOS safe-area). */}
      <AppShell>{children}</AppShell>
      <PwaClient />
      <AppBadgeClient />
      <QueueIndicator />
      <StubViewerCookie />

      <ToastHost />
</SideProvider>
  );
}
