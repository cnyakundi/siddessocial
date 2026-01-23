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
 * React hook for deterministic notifications unread.
 * Safe: falls back to 0 when restricted/offline.
 */
export function useNotificationsActivity(): NotificationsActivity {
  const { side } = useSide();
  const [a, setA] = useState<NotificationsActivity>(() => getNotificationsActivity());

  useEffect(() => {
    startNotificationsActivityEngine();
    const unsub = subscribeNotificationsActivity(setA);
    return () => unsub();
  }, []);

  useEffect(() => {
    refreshNotificationsActivity({ force: true }).catch(() => {});
  }, [side]);

  return a;
}
