"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { PushNotificationsCard } from "@/src/components/PushNotificationsCard";
import { PushPreferencesCard } from "@/src/components/PushPreferencesCard";

type MePayload = { authenticated?: boolean };

export default function AccountNotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as any as MePayload;
        if (!mounted) return;

        if (!j?.authenticated) {
          const next = encodeURIComponent("/siddes-profile/account/notifications");
          router.replace(`/login?next=${next}`);
          return;
        }
      } catch {
        if (!mounted) return;
        const next = encodeURIComponent("/siddes-profile/account/notifications");
        router.replace(`/login?next=${next}`);
        return;
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return <div className="p-4 text-xs text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">Notifications</div>
            <div className="text-xs text-gray-500 mt-1">Push settings for this device + what you get notified about</div>
          </div>

          <Link
            href="/siddes-profile/account"
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-4 space-y-4">
          {/* sd_743_push_prefs_ui */}
          <PushPreferencesCard />
          {/* sd_741_push_backend_db */}
          <PushNotificationsCard />
        </div>

        <div className="mt-6 text-xs text-gray-400">
          Alerts feed lives in <span className="font-semibold">Inbox → Alerts</span>.
        </div>
      </div>
    </div>
  );
}
