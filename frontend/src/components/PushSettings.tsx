"use client";

import React, { useEffect, useState } from "react";

type VapidResp = { publicKey: string; configured: boolean };

async function getVapidKey(): Promise<{ key: string | null; configured: boolean }> {
  try {
    const res = await fetch("/api/push/vapid", { cache: "no-store" });
    if (!res.ok) return { key: null, configured: false };
    const data = (await res.json()) as VapidResp;
    return { key: data.publicKey || null, configured: Boolean(data.configured && data.publicKey) };
  } catch {
    return { key: null, configured: false };
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function PushSettings() {
  const [supported, setSupported] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [vapidConfigured, setVapidConfigured] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
    setPerm(Notification.permission);
    getVapidKey().then((r) => setVapidConfigured(r.configured));
  }, []);

  const canAsk = supported && perm !== "denied";

  async function requestPermission() {
    setStatus("");
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p !== "granted") setStatus("Permission not granted.");
  }

  async function subscribe() {
    setStatus("");
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;

    const { key, configured } = await getVapidKey();
    setVapidConfigured(configured);

    if (!key || !configured) {
      setStatus("VAPID public key not configured yet. Set VAPID_PUBLIC_KEY in env.");
      return;
    }

    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      setSubscribed(true);
      setStatus("Subscribed (stored stub). Real persistence comes later.");
    } catch {
      setStatus("Subscribe failed (likely invalid VAPID key or permission constraints).");
    }
  }

  async function unsubscribe() {
    setStatus("");
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const endpoint = sub?.endpoint;

    if (sub) await sub.unsubscribe();

    if (endpoint) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }

    setSubscribed(false);
    setStatus("Unsubscribed (stub).");
  }

  function howToSendTest() {
    setStatus("Send test is server-side only. See docs/PUSH_NOTIFICATIONS.md for /api/push/send spec.");
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Push Notifications</h1>
      <p className="text-sm text-gray-600 mt-2">
        Enable push to get Side-aware “glimpse” notifications.
      </p>

      <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-4">
        <div className="text-sm font-bold text-gray-900 mb-1">Status</div>
        <div className="text-xs text-gray-600">
          Supported: <b>{supported ? "yes" : "no"}</b> • Permission: <b>{perm}</b> • VAPID:{" "}
          <b>{vapidConfigured ? "configured" : "missing"}</b>
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
            onClick={requestPermission}
            disabled={!canAsk || perm === "granted"}
          >
            Request permission
          </button>

          <button
            className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
            onClick={subscribe}
            disabled={!supported || perm !== "granted" || subscribed}
          >
            Subscribe
          </button>

          <button
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-800 text-sm font-bold hover:bg-gray-200 disabled:opacity-50"
            onClick={unsubscribe}
            disabled={!supported || !subscribed}
          >
            Unsubscribe
          </button>

          <button
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-800 text-sm font-bold hover:bg-gray-200"
            onClick={howToSendTest}
          >
            How to send test
          </button>
        </div>

        {status ? <div className="mt-4 text-xs text-gray-600">{status}</div> : null}
      </div>

      <div className="mt-6 text-xs text-gray-400">
        Tip: Generate keys with <code>npx web-push generate-vapid-keys</code> and set <code>VAPID_PUBLIC_KEY</code>.
      </div>
    </div>
  );
}
