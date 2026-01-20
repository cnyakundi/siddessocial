"use client";

import { useEffect, useState } from "react";

import type { SideId } from "@/src/lib/sides";
import type { SideActivityMap } from "@/src/lib/sideActivity";
import {
  getSideActivityMap,
  refreshSideActivityMap,
  setSideActivityActiveSide,
  startSideActivityEngine,
  subscribeSideActivity,
} from "@/src/lib/sideActivity";

export function useSideActivity(activeSide: SideId): SideActivityMap {
  const [activity, setActivity] = useState<SideActivityMap>(() => getSideActivityMap());

  useEffect(() => {
    setSideActivityActiveSide(activeSide);
    startSideActivityEngine();

    // Refresh the active side immediately on side change (threshold moment).
    refreshSideActivityMap({ force: true, sides: [activeSide] }).catch(() => {});

    const unsub = subscribeSideActivity(setActivity);
    return () => {
      unsub();
    };
  }, [activeSide]);

  return activity;
}
