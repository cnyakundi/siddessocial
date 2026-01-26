"use client";

/**
 * sd_747: PWA Hard Reload / Clear Caches
 *
 * Why: PWAs can get into weird states after deploy (stale SW + cached static assets).
 * This gives users a safe escape hatch.
 *
 * What it does (best-effort):
 *  - Clear Siddes local/session storage keys (sd.* / siddes.* / __sd_*)
 *  - Clear CacheStorage (siddes-* caches)
 *  - Unregister service workers
 *  - Reload
 *
 * It does NOT touch server-side caches.
 */

function safeKeys(storage: Storage): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k) keys.push(k);
    }
  } catch {
    // ignore
  }
  return keys;
}

export async function hardRefreshPwa(opts?: { confirm?: boolean }) {
  if (typeof window === "undefined") return;

  const needsConfirm = opts?.confirm !== false;
  if (needsConfirm) {
    const ok = window.confirm(
      "Hard reload will clear Siddes caches and reload the app.\n\nUse this if the PWA feels stuck after an update.\n\nContinue?"
    );
    if (!ok) return;
  }

  // 1) Clear app storage keys (don’t nuke everything; keep it prefix-scoped).
  try {
    const ks = safeKeys(window.localStorage);
    ks.forEach((k) => {
      if (k.startsWith("sd.") || k.startsWith("sd_") || k.startsWith("siddes.")) {
        try {
          window.localStorage.removeItem(k);
        } catch {}
      }
    });
  } catch {}

  try {
    const ks = safeKeys(window.sessionStorage);
    ks.forEach((k) => {
      if (k.startsWith("__sd_") || k.startsWith("sd.") || k.startsWith("sd:") || k.startsWith("siddes.")) {
        try {
          window.sessionStorage.removeItem(k);
        } catch {}
      }
    });
  } catch {}

  // 2) Ask any waiting SW to activate (best-effort)
  try {
    const ctrl = navigator.serviceWorker?.controller as any;
    if (ctrl && typeof ctrl.postMessage === "function") ctrl.postMessage({ type: "SKIP_WAITING" });
  } catch {}

  // 3) Clear CacheStorage for this origin
  try {
    if ("caches" in window) {
      const keys = await (window as any).caches.keys();
      if (Array.isArray(keys)) {
        await Promise.all(
          keys.map((k: string) => {
            if (String(k).startsWith("siddes-")) {
              return (window as any).caches.delete(k);
            }
            return Promise.resolve();
          })
        );
      }
    }
  } catch {}

  // 4) Unregister SWs (fresh start)
  try {
    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === "function") {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch {}

  // 5) Reload
  try {
    window.location.reload();
  } catch {
    // ignore
  }
}
