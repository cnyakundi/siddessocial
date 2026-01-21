"use client";

import { SideFeed } from "@/src/components/SideFeed";
import { useSearchParams } from "next/navigation";

export default function SiddesFeedPage() {
  const sp = useSearchParams();
  const r = sp.get("r") || "0";
  return <SideFeed key={r} />;
}
