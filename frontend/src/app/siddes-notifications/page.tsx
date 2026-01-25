"use client";

import React from "react";
import { NotificationsView } from "@/src/components/NotificationsView";
import { useReturnScrollRestore } from "@/src/hooks/returnScroll";

export default function SiddesNotificationsPage() {
  useReturnScrollRestore();
  return (
    <div className="px-4 py-4">
      <NotificationsView />
    </div>
  );
}
