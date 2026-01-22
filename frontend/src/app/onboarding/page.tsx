import { Suspense } from "react";
import { OnboardingEngine } from "@/src/components/onboarding/OnboardingEngine";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div />}> 
      <OnboardingEngine />
    </Suspense>
  );
}
