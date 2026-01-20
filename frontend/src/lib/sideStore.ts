import type { SideId } from "./sides";
import { isSideId } from "./sides";

export const ACTIVE_SIDE_STORAGE_KEY = "sd.activeSide";
export const LAST_NON_PUBLIC_SIDE_STORAGE_KEY = "sd.lastNonPublicSide";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredActiveSide(): SideId | null {
  if (!hasWindow()) return null;
  try {
    const v = window.localStorage.getItem(ACTIVE_SIDE_STORAGE_KEY);
    if (!v) return null;
    return isSideId(v) ? v : null;
  } catch {
    return null;
  }
}

export function setStoredActiveSide(side: SideId): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(ACTIVE_SIDE_STORAGE_KEY, side);
  } catch {
    // ignore
  }
}

export function clearStoredActiveSide(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(ACTIVE_SIDE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getStoredLastNonPublicSide(): SideId | null {
  if (!hasWindow()) return null;
  try {
    const v = window.localStorage.getItem(LAST_NON_PUBLIC_SIDE_STORAGE_KEY);
    if (!v) return null;
    return isSideId(v) && v !== "public" ? (v as SideId) : null;
  } catch {
    return null;
  }
}

export function setStoredLastNonPublicSide(side: SideId): void {
  if (!hasWindow()) return;
  if (side === "public") return;
  try {
    window.localStorage.setItem(LAST_NON_PUBLIC_SIDE_STORAGE_KEY, side);
  } catch {
    // ignore
  }
}

export function clearStoredLastNonPublicSide(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(LAST_NON_PUBLIC_SIDE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
