"use client";

import React from "react";
import { SideProvider } from "@/src/components/SideProvider";
import { SideChrome } from "@/src/components/SideChrome";
import { PwaClient } from "@/src/components/PwaClient";
import { QueueIndicator } from "@/src/components/QueueIndicator";
import { StubViewerCookie } from "@/src/components/StubViewerCookie";
import { TopNav } from "@/src/components/TopNav";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SideProvider>
      <TopNav />
      {children}
      <SideChrome />
      <PwaClient />
      <QueueIndicator />
      <StubViewerCookie />
    </SideProvider>
  );
}
