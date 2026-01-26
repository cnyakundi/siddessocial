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
      {/* sd_741_push_backend_db */}
      <PushPreferencesCard />
      <PushNotificationsCard />
      <NotificationsView />
    </div>
  );
}
