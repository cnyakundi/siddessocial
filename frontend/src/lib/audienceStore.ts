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

// sd_540a: Audience scope bus (Mode + Scope)
// - Keeps Side + Set/Topic changes in sync across headers, feeds, and compose entry points.
// - Uses an in-memory listener set (fast) and also dispatches a window CustomEvent (optional).

export const EVT_AUDIENCE_CHANGED = "sd:audience";

export type AudienceChange = {
  side: SideId;
  setId: SetId | null;
  topic: string | null;
  ts: number;
  source?: string;
};

const audienceListeners = new Set<(e: AudienceChange) => void>();

export function emitAudienceChanged(input: {
  side: SideId;
  setId?: SetId | null;
  topic?: string | null;
  source?: string;
  ts?: number;
}) {
  const evt: AudienceChange = {
    side: input.side,
    setId: ("setId" in input ? (input.setId ?? null) : null) as any,
    topic: ("topic" in input ? (input.topic ?? null) : null) as any,
    source: input.source,
    ts: typeof input.ts === "number" && Number.isFinite(input.ts) ? input.ts : Date.now(),
  };

  for (const fn of Array.from(audienceListeners)) {
    try {
      fn(evt);
    } catch {}
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(EVT_AUDIENCE_CHANGED, { detail: evt }));
    } catch {}
  }
}

export function subscribeAudienceChanged(fn: (e: AudienceChange) => void): () => void {
  audienceListeners.add(fn);
  return () => {
    audienceListeners.delete(fn);
  };
}
