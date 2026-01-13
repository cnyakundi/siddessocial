"use client";

export const EVT_SETS_CHANGED = "sd.sets.changed";

const LS_SETS_CHANGED_AT = "sd.sets.changedAt";

/**
 * Fired when Sets visibility/membership might have changed.
 * Example: accepting an invite adds you as a member.
 */
export function emitSetsChanged(): void {
  if (typeof window === "undefined") return;

  // Broadcast to other tabs (best-effort) then notify this tab.
  try {
    window.localStorage.setItem(LS_SETS_CHANGED_AT, String(Date.now()));
  } catch {
    // ignore
  }

  window.dispatchEvent(new Event(EVT_SETS_CHANGED));
}

export function onSetsChanged(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => fn();
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_SETS_CHANGED_AT) handler();
  };

  window.addEventListener(EVT_SETS_CHANGED, handler);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(EVT_SETS_CHANGED, handler);
    window.removeEventListener("storage", onStorage);
  };
}
