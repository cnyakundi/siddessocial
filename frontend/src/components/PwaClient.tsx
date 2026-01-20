"use client";

import React, { useEffect, useMemo, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function PwaClient() {
  const IS_PROD = process.env.NODE_ENV === "production";

  const [offline, setOffline] = useState(false);

  // Install prompt
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [installAvailable, setInstallAvailable] = useState(false);

  // Update prompt
  const [waitingReg, setWaitingReg] = useState<ServiceWorkerRegistration | null>(null);
  const updateAvailable = Boolean(waitingReg?.waiting);

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

  // Install prompt handling
  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
      setInstallAvailable(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  // Service worker registration + update detection
  useEffect(() => {
    if (!IS_PROD) return;
    if (!("serviceWorker" in navigator)) return;

    let mounted = true;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (!mounted) return;

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

        // Reload when controller changes (after SKIP_WAITING)
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });
      } catch {
        // SW registration can fail in some dev scenarios; ignore.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [IS_PROD]);

  const showBar = offline || installAvailable || updateAvailable;

  if (!showBar) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[120] flex justify-center pointer-events-none">
      <div className="pointer-events-auto max-w-xl w-full bg-white border border-gray-200 shadow-lg rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {offline ? (
            <>
              <div className="text-sm font-bold text-gray-900">You’re offline</div>
              <div className="text-xs text-gray-500 truncate">
                Showing cached content when available.
              </div>
            </>
          ) : updateAvailable ? (
            <>
              <div className="text-sm font-bold text-gray-900">Update available</div>
              <div className="text-xs text-gray-500 truncate">
                Reload to get the latest version.
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-gray-900">Install Siddes</div>
              <div className="text-xs text-gray-500 truncate">
                Add to your home screen for the best experience.
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {updateAvailable ? (
            <button
              type="button"
              className="px-3 py-2 rounded-full bg-gray-900 text-white text-xs font-bold hover:opacity-90"
              onClick={() => {
                const w = waitingReg?.waiting;
                if (w) w.postMessage({ type: "SKIP_WAITING" });
              }}
            >
              Reload
            </button>
          ) : installAvailable ? (
            <button
              type="button"
              className="px-3 py-2 rounded-full bg-gray-900 text-white text-xs font-bold hover:opacity-90"
              onClick={async () => {
                if (!installEvt) return;
                try {
                  await installEvt.prompt();
                  const res = await installEvt.userChoice;
                  // Regardless of choice, hide prompt.
                  setInstallEvt(null);
                  setInstallAvailable(false);
                } catch {
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
            className="px-3 py-2 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200"
            onClick={() => {
              // dismiss current banners (offline stays handled by state)
              setInstallAvailable(false);
              setWaitingReg(null);
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
