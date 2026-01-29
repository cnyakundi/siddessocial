"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { SideProvider } from "@/src/components/SideProvider";
import { AppShell } from "@/src/components/AppShell";
import { ThemeColorSync } from "@/src/components/ThemeColorSync";
import { AuthBootstrap } from "@/src/components/AuthBootstrap";
import { NavEventBridge } from "@/src/components/NavEventBridge";

// Lazy-loaded, non-critical chrome. Keeps initial JS + hydration smaller.
const FirstRunSidePicker = dynamic(() => import("@/src/components/FirstRunSidePicker").then((m) => m.FirstRunSidePicker), { ssr: false });
const PwaClient = dynamic(() => import("@/src/components/PwaClient").then((m) => m.PwaClient), { ssr: false });
const AppBadgeClient = dynamic(() => import("@/src/components/AppBadgeClient").then((m) => m.AppBadgeClient), { ssr: false });
const QueueIndicator = dynamic(() => import("@/src/components/QueueIndicator").then((m) => m.QueueIndicator), { ssr: false });
const StubViewerCookie = dynamic(() => import("@/src/components/StubViewerCookie").then((m) => m.StubViewerCookie), { ssr: false });
const ToastHost = dynamic(() => import("@/src/components/ToastHost").then((m) => m.ToastHost), { ssr: false });

function IdleMount({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (cancelled) return;
      setReady(true);
    };

    try {
      const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: any) => number) | undefined;
      if (typeof ric === "function") {
        ric(done, { timeout: 1200 });
      } else {
        window.setTimeout(done, 250);
      }
    } catch {
      window.setTimeout(done, 250);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SideProvider>
      <ThemeColorSync />
      <NavEventBridge />
      <AuthBootstrap />

      {/* Reserve space for BottomNav (and iOS safe-area). */}
      <AppShell>{children}</AppShell>

      <IdleMount>
        <FirstRunSidePicker />
        <PwaClient />
        <AppBadgeClient />
        <QueueIndicator />
        <StubViewerCookie />
        <ToastHost />
      </IdleMount>
    </SideProvider>
  );
}
