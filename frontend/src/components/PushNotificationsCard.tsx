"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bell, Copy, Send, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "@/src/lib/toast";

// sd_741_push_backend_db: push permission + subscribe + save-to-backend + debug send
const LS_KEY = "sd_push_subscription_v1";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function safeJson(x: unknown) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return "";
  }
}

type StatusResp = {
  ok: boolean;
  restricted?: boolean;
  count?: number;
  pushEnabled?: boolean;
  pushOnNotificationsEnabled?: boolean;
  vapidConfigured?: boolean;
  pywebpushAvailable?: boolean;
  error?: string;
};

export function PushNotificationsCard() {
  const supported = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }, []);

  const vapid = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();

  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subJson, setSubJson] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [serverDiag, setServerDiag] = useState<{
    pushEnabled?: boolean;
    pushOnNotificationsEnabled?: boolean;
    vapidConfigured?: boolean;
    pywebpushAvailable?: boolean;
  } | null>(null);

  async function refreshStatus() {
    try {
      const res = await fetch("/api/push/status", { method: "GET" });
      const data = (await res.json()) as StatusResp;
      if (data && typeof data.count === "number") setServerCount(data.count);
      else setServerCount(null);
    } catch {
      setServerCount(null);
    }
  }

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);

    try {
      const raw = localStorage.getItem(LS_KEY) || "";
      if (raw) setSubJson(raw);
    } catch {
      // ignore
    }

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const j = safeJson(sub.toJSON());
          if (j) {
            setSubJson(j);
            try {
              localStorage.setItem(LS_KEY, j);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      } finally {
        refreshStatus();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  if (!supported) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <ShieldAlert className="h-4 w-4" />
          Push notifications not supported
        </div>
        <div className="mt-1 text-xs text-gray-600">
          This browser/device doesn’t support Web Push (or you’re not installed as a PWA).
        </div>
      </div>
    );
  }

  const hasSub = Boolean(subJson);

  async function requestPermission() {
    setBusy(true);
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") toast.error("Push permission not granted.");
    } catch {
      toast.error("Could not request notification permission.");
    } finally {
      setBusy(false);
    }
  }

  async function saveToBackend(subscription: any) {
    try {
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.restricted) {
        toast.error("Push saved locally, but backend is restricted (no viewer).");
      }
    } catch {
      toast.error("Could not save subscription to backend.");
    } finally {
      refreshStatus();
    }
  }

  async function subscribe() {
    if (!vapid) {
      toast.error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const cur = await reg.pushManager.getSubscription();
      if (cur) {
        const j = safeJson(cur.toJSON());
        if (j) {
          setSubJson(j);
          try {
            localStorage.setItem(LS_KEY, j);
          } catch {}
        }
        await saveToBackend(cur.toJSON());
        toast.success("Already subscribed.");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });

      const j = safeJson(sub.toJSON());
      setSubJson(j);
      try {
        localStorage.setItem(LS_KEY, j);
      } catch {}

      await saveToBackend(sub.toJSON());
      toast.success("Subscribed.");
    } catch {
      toast.error("Subscribe failed. Are you installed as a PWA?");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const cur = await reg.pushManager.getSubscription();
      const endpoint =
        cur?.endpoint ||
        (() => {
          try {
            const j = JSON.parse(subJson || "{}");
            return String(j.endpoint || "");
          } catch {
            return "";
          }
        })();

      if (cur) await cur.unsubscribe();

      if (endpoint) {
        try {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
        } catch {}
      }

      setSubJson("");
      try {
        localStorage.removeItem(LS_KEY);
      } catch {}

      toast.success("Unsubscribed.");
    } catch {
      toast.error("Unsubscribe failed.");
    } finally {
      setBusy(false);
      refreshStatus();
    }
  }

  async function copy() {
    if (!subJson) return;
    try {
      await navigator.clipboard.writeText(subJson);
      toast.success("Copied subscription JSON.");
    } catch {
      toast.error("Copy failed.");
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/debug/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Siddes",
          body: "Test push from backend",
          url: "/siddes-notifications",
          side: "friends",
          glimpse: "This is a test push (backend → Web Push).",
          badge: 1,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) toast.success("Sent test push.");
      else toast.error(data?.error || "Test push failed.");
    } catch {
      toast.error("Test push failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Bell className="h-4 w-4" />
            Device notifications (Push)
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Permission: <span className="font-semibold">{permission}</span>
            {serverCount !== null ? <span className="ml-2 text-gray-500">Server devices: {serverCount}</span> : null}
            {serverDiag?.pushEnabled === false ? (
              <span className="ml-2 text-rose-600 font-semibold">Server push disabled</span>
            ) : null}
            {serverDiag?.vapidConfigured === false ? (
              <span className="ml-2 text-rose-600 font-semibold">Server VAPID missing</span>
            ) : null}
            {serverDiag?.pywebpushAvailable === false ? (
              <span className="ml-2 text-rose-600 font-semibold">Server pywebpush missing</span>
            ) : null}
            {serverDiag?.pushOnNotificationsEnabled === false ? (
              <span className="ml-2 text-rose-600 font-semibold">Auto-push off</span>
            ) : null}
            {!vapid ? <span className="ml-2 text-rose-600 font-semibold">Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {permission !== "granted" ? (
            <button
              type="button"
              disabled={busy}
              className={cn(
                "px-3 py-2 rounded-full text-xs font-bold",
                busy ? "bg-gray-100 text-gray-400" : "bg-gray-900 text-white hover:opacity-90"
              )}
              onClick={requestPermission}
            >
              Enable
            </button>
          ) : hasSub ? (
            <>
              <button
                type="button"
                disabled={busy}
                className={cn(
                  "px-3 py-2 rounded-full text-xs font-bold flex items-center gap-2",
                  busy ? "bg-gray-100 text-gray-400" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                )}
                onClick={copy}
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>

              {process.env.NODE_ENV !== "production" ? (
                <button
                  type="button"
                  disabled={busy}
                  className={cn(
                    "px-3 py-2 rounded-full text-xs font-bold flex items-center gap-2",
                    busy ? "bg-gray-100 text-gray-400" : "bg-gray-900 text-white hover:opacity-90"
                  )}
                  onClick={sendTest}
                >
                  <Send className="h-4 w-4" />
                  Test
                </button>
              ) : null}

              <button
                type="button"
                disabled={busy}
                className={cn(
                  "px-3 py-2 rounded-full text-xs font-bold flex items-center gap-2",
                  busy ? "bg-gray-100 text-gray-400" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                )}
                onClick={unsubscribe}
              >
                <Trash2 className="h-4 w-4" />
                Off
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy || !vapid}
              className={cn(
                "px-3 py-2 rounded-full text-xs font-bold",
                busy || !vapid ? "bg-gray-100 text-gray-400" : "bg-gray-900 text-white hover:opacity-90"
              )}
              onClick={subscribe}
            >
              Subscribe
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-600">
        {permission === "granted" ? (
          hasSub ? (
            <div>
              <div className="font-semibold text-gray-900">Subscription JSON (stored locally + sent to backend)</div>
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-800">
{subJson}
              </pre>
              {process.env.NODE_ENV !== "production" ? (
                <div className="mt-2 text-[11px] text-gray-500">
                  Dev test requires backend env: <span className="font-semibold">SIDDES_VAPID_PRIVATE_KEY</span> and{" "}
                  <span className="font-semibold">SIDDES_VAPID_SUBJECT</span>.
                </div>
              ) : null}
            </div>
          ) : (
            <div>Subscribe to generate a device token (subscription). Backend can later send pushes.</div>
          )
        ) : (
          <div>To enable push, allow notifications. (iOS requires installing to Home Screen and iOS 16.4+.)</div>
        )}
      </div>
    </div>
  );
}
