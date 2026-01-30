"use client";

export const EVT_CIRCLES_CHANGED = "sd.circles.changed";

const LS_CIRCLES_CHANGED_AT = "sd.circles.changedAt";

/**
 * Fired when Sets visibility/membership might have changed.
 * Example: accepting an invite adds you as a member.
 */
export function emitCirclesChanged(): void {
  if (typeof window === "undefined") return;

  // Broadcast to other tabs (best-effort) then notify this tab.
  try {
    window.localStorage.setItem(LS_CIRCLES_CHANGED_AT, String(Date.now()));
  } catch {
    // ignore
  }

  window.dispatchEvent(new Event(EVT_CIRCLES_CHANGED));
}

export function onCirclesChanged(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => fn();
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_CIRCLES_CHANGED_AT) handler();
  };

  window.addEventListener(EVT_CIRCLES_CHANGED, handler);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(EVT_CIRCLES_CHANGED, handler);
    window.removeEventListener("storage", onStorage);
  };
}
