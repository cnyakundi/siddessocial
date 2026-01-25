"use client";

import { clearInboxCache } from "@/src/lib/inboxCache";
import { clearFeedInstantCache } from "@/src/lib/feedInstantCache";
import { clearQueue } from "@/src/lib/offlineQueue";
import { clearSessionIdentity } from "@/src/lib/sessionIdentity";

/**
 * Clear client-side private caches that must not survive logout / user changes.
 *
 * Keep it small + explicit (no magic).
 */
export function clearPrivateClientCaches() {
  try {
    clearFeedInstantCache();
  } catch {}

  try {
    clearInboxCache();
  } catch {}

  try {
    clearQueue();
  } catch {}

  try {
    clearSessionIdentity();
  } catch {}
}
