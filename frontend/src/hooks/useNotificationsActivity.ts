"use client";

import { useEffect, useState } from "react";
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
  const [a, setA] = useState<NotificationsActivity>(() => getNotificationsActivity());

  useEffect(() => {
    startNotificationsActivityEngine();
    refreshNotificationsActivity({ force: true }).catch(() => {});
    const unsub = subscribeNotificationsActivity(setA);
    return () => unsub();
  }, []);

  return a;
}
