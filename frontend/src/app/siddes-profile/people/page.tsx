"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import PrismPeopleStep from "@/src/components/onboarding/steps/PrismPeopleStep";

/**
 * Standalone "People sorting" surface (not buried in Settings).
 * Keeps BottomNav "Me" tab active by living under /siddes-profile/*.
 */
export default function PrismPeopleProfilePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <div className="fixed top-0 left-0 right-0 z-20 px-4 py-4 flex items-center justify-between bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="text-sm font-extrabold text-gray-900">Prism People</div>
        <Link href="/siddes-profile" className="text-xs font-bold text-gray-700 hover:text-gray-900">
          Back
        </Link>
      </div>

      <PrismPeopleStep
        onContinue={() => router.push("/siddes-profile")}
        onSkip={() => router.push("/siddes-profile")}
      />
    </div>
  );
}
