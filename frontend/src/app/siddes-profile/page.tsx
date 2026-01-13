"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProfileView } from "@/src/components/ProfileView";

function UserSwitcher({ current }: { current: string }) {
  const items = [
    { id: "elena", label: "Elena" },
    { id: "marcus", label: "Marcus" },
    { id: "sarah", label: "Sarah" },
    { id: "me", label: "Me" },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {items.map((u) => (
        <Link
          key={u.id}
          href={`/siddes-profile?u=${u.id}`}
          className={`px-3 py-1.5 rounded-full text-sm font-bold border ${
            current === u.id
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          }`}
        >
          {u.label}
        </Link>
      ))}
    </div>
  );
}

function ProfilePageInner() {
  const sp = useSearchParams();
  const u = sp.get("u") ?? "elena";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Link href="/siddes-feed" className="text-sm font-bold text-gray-700 hover:underline">
            ← Feed
          </Link>
          <UserSwitcher current={u} />
        </div>
      </div>

      <ProfileView userId={u} onBack={() => (window.location.href = "/siddes-feed")} />
    </div>
  );
}

export default function SiddesProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
          Loading…
        </div>
      }
    >
      <ProfilePageInner />
    </Suspense>
  );
}
