"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SiddesNotificationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/siddes-inbox?tab=alerts");
  }, [router]);

  return <div className="px-4 py-4 text-xs text-gray-500">Redirecting to Inbox alerts…</div>;
}
