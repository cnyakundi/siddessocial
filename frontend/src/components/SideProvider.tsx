"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ACTIVE_SIDE_STORAGE_KEY, getStoredActiveSide, setStoredActiveSide } from "@/src/lib/sideStore";
import { nextSide, type SideId } from "@/src/lib/sides";

type SideContextValue = {
  side: SideId;
  setSide: (side: SideId) => void;
  cycleSide: (dir?: 1 | -1) => void;
};

const SideContext = createContext<SideContextValue | null>(null);

export function SideProvider({ children }: { children: React.ReactNode }) {
  const [side, setSideState] = useState<SideId>("public");

  useEffect(() => {
    const stored = getStoredActiveSide();
    if (stored) setSideState(stored);
  }, []);

  const setSide = (s: SideId) => {
    setSideState(s);
    setStoredActiveSide(s);
  };

  const cycleSide = (dir: 1 | -1 = 1) => {
    setSide(nextSide(side, dir));
  };

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== ACTIVE_SIDE_STORAGE_KEY) return;
      if (!e.newValue) return;
      const v = e.newValue as SideId;
      if (v === "public" || v === "friends" || v === "close" || v === "work") {
        setSideState(v);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value: SideContextValue = { side, setSide, cycleSide };

  return <SideContext.Provider value={value}>{children}</SideContext.Provider>;
}

export function useSide(): SideContextValue {
  const ctx = useContext(SideContext);
  if (!ctx) throw new Error("useSide must be used within SideProvider");
  return ctx;
}
