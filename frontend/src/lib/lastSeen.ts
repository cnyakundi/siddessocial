"use client";

import type { SideId } from "@/src/lib/sides";

const KEY_PREFIX = "sd.lastSeen.v0.";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getLastSeenId(side: SideId): string | null {
  if (!hasWindow()) return null;
  try {
    return window.localStorage.getItem(KEY_PREFIX + side);
  } catch {
    return null;
  }
}

export function setLastSeenId(side: SideId, postId: string) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(KEY_PREFIX + side, postId);
  } catch {
    // ignore
  }
}

export function clearLastSeen(side?: SideId) {
  if (!hasWindow()) return;
  try {
    if (side) window.localStorage.removeItem(KEY_PREFIX + side);
    else {
      // clear all sides
      ["public", "friends", "close", "work"].forEach((s) => window.localStorage.removeItem(KEY_PREFIX + s));
    }
  } catch {
    // ignore
  }
}
