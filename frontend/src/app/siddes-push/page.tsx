"use client";

import Link from "next/link";
import { PushSettings } from "@/src/components/PushSettings";

export default function SiddesPushPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Link href="/siddes-feed" className="text-sm font-bold text-gray-700 hover:underline">
            ← Feed
          </Link>
          <Link href="/siddes-notifications" className="text-sm font-bold text-gray-700 hover:underline">
            Notifications
          </Link>
        </div>
      </div>
      <PushSettings />
    </div>
  );
}
