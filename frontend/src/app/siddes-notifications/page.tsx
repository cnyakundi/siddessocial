"use client";

import React from "react";
import { PushNotificationsCard } from "@/src/components/PushNotificationsCard";
import { PushPreferencesCard } from "@/src/components/PushPreferencesCard";
import { NotificationsView } from "@/src/components/NotificationsView";
import { useReturnScrollRestore } from "@/src/hooks/returnScroll";

export default function SiddesNotificationsPage() {
  useReturnScrollRestore();
  return (
    <div className="px-4 py-4 space-y-4">
      {/* sd_768_clean_alerts_page_hide_push_debug: show Alerts first; keep push tools optional */}
      <NotificationsView embedded />

      <details className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer select-none text-sm font-black text-gray-900 flex items-center justify-between list-none">
          Push settings
          <span className="text-[11px] font-bold text-gray-400">Optional</span>
        </summary>
        <div className="px-4 pb-4 space-y-3">
          {/* sd_741_push_backend_db */}
          <PushPreferencesCard />
          <PushNotificationsCard />
        </div>
      </details>
    </div>
  );
}
