"use client";

import Link from "next/link";
import { NotificationsView } from "@/src/components/NotificationsView";

export default function SiddesNotificationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Link href="/siddes-feed" className="text-sm font-bold text-gray-700 hover:underline">
            ← Feed
          </Link>
          <Link href="/siddes-profile" className="text-sm font-bold text-gray-700 hover:underline">
            Profile
          </Link>
        </div>
      </div>

      <NotificationsView />
    </div>
  );
}
