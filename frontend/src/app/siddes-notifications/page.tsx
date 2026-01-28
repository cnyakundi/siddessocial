"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// sd_771_alerts_alias: keep /siddes-notifications as an alias to the unified Inbox Alerts tab.
// Push settings live in Profile → Account → Notifications.
const TARGET = "/siddes-inbox?tab=alerts";

export default function SiddesNotificationsAliasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(TARGET);
  }, [router]);

  return (
    <div className="p-4">
      <div className="max-w-md mx-auto rounded-2xl border border-gray-200 bg-white p-5">
        <div className="text-sm font-black text-gray-900">Redirecting…</div>
        <div className="text-xs text-gray-500 mt-1">Opening Alerts.</div>
        <div className="mt-3">
          <Link
            href={TARGET}
            className="inline-flex px-4 py-2.5 rounded-xl text-sm font-extrabold bg-gray-900 text-white"
          >
            Continue
          </Link>
        </div>
      </div>
    </div>
  );
}
