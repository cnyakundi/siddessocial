"use client";

import { useEffect, useState } from "react";
import { useSide } from "@/src/components/SideProvider";
import {
  getNotificationsActivity,
  refreshNotificationsActivity,
  startNotificationsActivityEngine,
  subscribeNotificationsActivity,
  type NotificationsActivity,
} from "@/src/lib/notificationsActivity";

/**
 * React hook for deterministic notifications unread (Side-scoped).
 * Safe: falls back to 0 when restricted/offline.
 */
export function useNotificationsActivity(): NotificationsActivity {
  const { side } = useSide();
  const [a, setA] = useState<NotificationsActivity>(() => getNotificationsActivity(side));

  useEffect(() => {
    // Ensure the poll engine follows the current Side.
    startNotificationsActivityEngine(side);

    // Subscribe to this Side's unread updates.
    const unsub = subscribeNotificationsActivity(side, setA);

    // Immediate refresh on mount + whenever Side changes.
    refreshNotificationsActivity({ force: true, side }).catch(() => {});
    return () => unsub();
  }, [side]);

  return a;
}
