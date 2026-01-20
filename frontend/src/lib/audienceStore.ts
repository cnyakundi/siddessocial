import type { SideId } from "./sides";
import type { SetId } from "./sets";

const KEY_SET_PREFIX = "sd.feed.lastSet.";
const KEY_TOPIC = "sd.feed.lastPublicTopic";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredLastSetForSide(side: SideId): SetId | null {
  if (!hasWindow()) return null;
  try {
    const v = window.localStorage.getItem(KEY_SET_PREFIX + side);
    return v && typeof v === "string" ? (v as SetId) : null;
  } catch {
    return null;
  }
}

export function setStoredLastSetForSide(side: SideId, setId: SetId | null): void {
  if (!hasWindow()) return;
  if (side === "public") return;
  try {
    const key = KEY_SET_PREFIX + side;
    if (!setId) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(setId));
  } catch {
    // ignore
  }
}

export function getStoredLastPublicTopic(): string | null {
  if (!hasWindow()) return null;
  try {
    const v = window.localStorage.getItem(KEY_TOPIC);
    return v && typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

export function setStoredLastPublicTopic(topic: string | null): void {
  if (!hasWindow()) return;
  try {
    if (!topic) window.localStorage.removeItem(KEY_TOPIC);
    else window.localStorage.setItem(KEY_TOPIC, String(topic));
  } catch {
    // ignore
  }
}
