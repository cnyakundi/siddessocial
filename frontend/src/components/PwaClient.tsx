"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function isIOSPlatform() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIPhoneIPadIPod = /iPad|iPhone|iPod/.test(ua);

  // iPadOS 13+ reports as MacIntel but has touch points.
  const platform = String((navigator as any).platform || "");
  const maxTouchPoints = Number((navigator as any).maxTouchPoints || 0);
  const isIPadOS = (platform === "MacIntel" || platform === "MacPPC") && maxTouchPoints > 1;

  return Boolean(isIPhoneIPadIPod || isIPadOS);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  // iOS: navigator.standalone (non-standard). Others: display-mode media query.
  const iosStandalone = Boolean((navigator as any).standalone);
  const dmStandalone = Boolean(window.matchMedia?.("(display-mode: standalone)").matches);
  return iosStandalone || dmStandalone;
}

function safeNow() {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

export function PwaClient() {
  const IS_PROD = process.env.NODE_ENV === "production";
  const DEV_SW = process.env.NEXT_PUBLIC_PWA_DEV === "1";
  const ENABLE_SW = IS_PROD || DEV_SW;

  const [offline, setOffline] = useState(false);

  // Install prompt (Chromium/Android)
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [installAvailable, setInstallAvailable] = useState(false);

  // iOS install help (Safari "Add to Home Screen")
  const [iosInstallHint, setIosInstallHint] = useState(false);

  // Update prompt
  const [waitingReg, setWaitingReg] = useState<ServiceWorkerRegistration | null>(null);
  const updateAvailable = Boolean(waitingReg?.waiting);

  // sd_905_pwa_update_now_and_autocheck
  const updateRequestedRef = useRef(false);
  const [updating, setUpdating] = useState(false);

  const isIOS = useMemo(() => isIOSPlatform(), []);
  const standalone = useMemo(() => isStandaloneMode(), []);

  useEffect(() => {
    function onOnline() {
      setOffline(false);
    }
    function onOffline() {
      setOffline(true);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Install prompt handling (Chromium)
  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
      setInstallAvailable(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  // iOS install hint (Safari only; no beforeinstallprompt)
  useEffect(() => {
    if (!isIOS) return;
    if (standalone) return;
    try {
      const key = "siddes.ios.install_hint.dismissed";
      if (window.localStorage.getItem(key) === "1") return;
      setIosInstallHint(true);
    } catch {
      // ignore
    }
  }, [isIOS, standalone]);

  // Service worker registration + update detection + periodic update checks
  useEffect(() => {
    if (!ENABLE_SW) return;
    if (!("serviceWorker" in navigator)) return;

    let mounted = true;
    let regRef: ServiceWorkerRegistration | null = null;

    // Throttle update checks so multiple tabs don't spam update().
    const THROTTLE_KEY = "siddes.pwa.last_update_check_ms";
    const MIN_CHECK_MS = 10 * 60 * 1000; // 10 min
    const INTERVAL_MS = 30 * 60 * 1000; // 30 min

    const shouldCheck = () => {
      if (!mounted) return false;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
      return true;
    };

    const canRunNow = () => {
      try {
        const t = safeNow();
        const last = Number(window.localStorage.getItem(THROTTLE_KEY) || "0");
        if (!Number.isFinite(last)) return true;
        return t - last >= MIN_CHECK_MS;
      } catch {
        return true;
      }
    };

    const markRun = () => {
      try {
        window.localStorage.setItem(THROTTLE_KEY, String(safeNow()));
      } catch {
        // ignore
      }
    };

    const maybeUpdate = async () => {
      const r = regRef;
      if (!r) return;
      if (!shouldCheck()) return;
      if (!canRunNow()) return;
      markRun();
      try {
        await r.update();
      } catch {
        // ignore
      }
    };

    // Reload once when the new SW takes control (after SKIP_WAITING), but only if user requested it.
    // Guarded to prevent reload loops (dev/hot reload can trigger multiple controllerchange events).
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;

      if (updateRequestedRef.current) {
        try {
          window.location.reload();
        } catch {
          // ignore
        }
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onFocusLike = () => {
      void maybeUpdate();
    };
    window.addEventListener("focus", onFocusLike);
    window.addEventListener("online", onFocusLike);
    document.addEventListener("visibilitychange", onFocusLike);

    let intervalId: number | null = null;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (!mounted) return;

        regRef = reg;

        // If there's already a waiting worker, surface update
        if (reg.waiting) setWaitingReg(reg);

        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            // When new worker is installed and there's an existing controller,
            // an update is available.
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingReg(reg);
            }
          });
        });

        // Kick one check shortly after mount (helps “new deploy picked up”).
        window.setTimeout(() => void maybeUpdate(), 2500);

        // Background periodic check (throttled).
        intervalId = window.setInterval(() => void maybeUpdate(), INTERVAL_MS);
      } catch {
        // SW registration can fail in some environments; ignore.
      }
    })();

    return () => {
      mounted = false;
      try {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      } catch {}
      try {
        window.removeEventListener("focus", onFocusLike);
        window.removeEventListener("online", onFocusLike);
        document.removeEventListener("visibilitychange", onFocusLike);
      } catch {}
      try {
        if (intervalId) window.clearInterval(intervalId);
      } catch {}
    };
  }, [ENABLE_SW]);

  const showBar = offline || installAvailable || updateAvailable || iosInstallHint;
  if (!showBar) return null;

  const dismissLabel = iosInstallHint && !installAvailable && !updateAvailable && !offline ? "Got it" : "Dismiss";

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[92] flex justify-center pointer-events-none">
      <div className="pointer-events-auto max-w-xl w-full bg-white border border-gray-200 shadow-lg rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {offline ? (
            <>
              <div className="text-sm font-bold text-gray-900">You’re offline</div>
              <div className="text-xs text-gray-500 truncate">Reconnect to refresh. Some screens may not load offline yet.</div>
            </>
          ) : updateAvailable ? (
            <>
              <div className="text-sm font-bold text-gray-900">{updating ? "Updating…" : "Update ready"}</div>
              <div className="text-xs text-gray-500 truncate">{updating ? "Reloading the app with the latest build." : "Tap Update to reload now."}</div>
            </>
          ) : installAvailable ? (
            <>
              <div className="text-sm font-bold text-gray-900">Install Siddes</div>
              <div className="text-xs text-gray-500 truncate">Add to your home screen for the best experience.</div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-gray-900">Add Siddes to Home Screen</div>
              <div className="text-xs text-gray-500 truncate">iPhone/iPad: Safari → Share → Add to Home Screen.</div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {updateAvailable ? (
            <button
              type="button"
              className={cn(
                "px-3 py-2 rounded-full text-xs font-bold",
                updating ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gray-900 text-white hover:opacity-90"
              )}
              disabled={updating}
              aria-disabled={updating}
              onClick={() => {
                if (updating) return;
                setUpdating(true);
                updateRequestedRef.current = true;

                const w = waitingReg?.waiting;
                try {
                  if (w) w.postMessage({ type: "SKIP_WAITING" });
                } catch {
                  // ignore
                }

                // Fallback: if controllerchange doesn't fire (rare), reload anyway.
                window.setTimeout(() => {
                  if (!updateRequestedRef.current) return;
                  try {
                    window.location.reload();
                  } catch {
                    // ignore
                  }
                }, 4500);

                // Hide the bar (we’re reloading imminently).
                setWaitingReg(null);
              }}
            >
              {updating ? "Updating…" : "Update"}
            </button>
          ) : installAvailable ? (
            <button
              type="button"
              className="px-3 py-2 rounded-full bg-gray-900 text-white text-xs font-bold hover:opacity-90"
              onClick={async () => {
                if (!installEvt) return;
                try {
                  await installEvt.prompt();
                  await installEvt.userChoice;
                } catch {
                  // ignore
                } finally {
                  setInstallEvt(null);
                  setInstallAvailable(false);
                }
              }}
            >
              Install
            </button>
          ) : null}

          <button
            type="button"
            className={cn(
              "px-3 py-2 rounded-full text-xs font-bold hover:bg-gray-200",
              dismissLabel === "Got it" ? "bg-gray-900 text-white hover:opacity-90" : "bg-gray-100 text-gray-700"
            )}
            onClick={() => {
              // dismiss current banners (offline stays handled by state)
              setInstallAvailable(false);
              setWaitingReg(null);
              setIosInstallHint(false);
              try {
                if (iosInstallHint) window.localStorage.setItem("siddes.ios.install_hint.dismissed", "1");
              } catch {
                // ignore
              }
            }}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
