"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES } from "@/src/lib/sides";

import { ProgressDots, StepWrapper } from "@/src/components/onboarding/ui";
import PrivacyModal from "@/src/components/onboarding/PrivacyModal";

import WelcomeStep from "@/src/components/onboarding/steps/WelcomeStep";
import CreateFirstSetStep from "@/src/components/onboarding/steps/CreateFirstSetStep";
import FirstPostStep from "@/src/components/onboarding/steps/FirstPostStep";

type StepId = "welcome" | "create_set" | "first_post";
const STEP_ORDER: StepId[] = ["welcome", "create_set", "first_post"];

type MeResp = {
  ok: boolean;
  authenticated?: boolean;
  user?: { id: number; username: string; email: string };
  viewerId?: string;
  emailVerified?: boolean;
  ageGateConfirmed?: boolean;
  minAge?: number;
  onboarding?: { completed: boolean; step?: string; contact_sync_done?: boolean };
};

type SetItem = { id: string; label: string; side: SideId; color?: string; members?: string[] };
type SetsCreateResp = { ok: boolean; item?: SetItem; error?: string };

/**
 * sd_718: Radical onboarding simplify
 * Old: welcome → username → sides explainer → create_set → add_people → prism_people → first_post → install
 * New: welcome (includes side preview) → create_set → first_post (both skippable)
 */
export function OnboardingEngine() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextHref = useMemo(() => {
    const raw = String(sp?.get("next") || "/siddes-feed");
    return raw.startsWith("/") ? raw : "/siddes-feed";
  }, [sp]);

  const [me, setMe] = useState<MeResp | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [stepId, setStepId] = useState<StepId>("welcome");

  const needsAgeGate = !Boolean(me?.ageGateConfirmed);
  const minAge = Number(me?.minAge || 13);

  const [ageOk, setAgeOk] = useState(false);
  const [ageBusy, setAgeBusy] = useState(false);
  const [ageErr, setAgeErr] = useState<string | null>(null);

  const [setBusy, setSetBusy] = useState(false);
  const [setMsg, setSetMsg] = useState<string | null>(null);
  const [firstSet, setFirstSet] = useState<{ id: string; name: string; side: SideId } | null>(null);

  const [finishBusy, setFinishBusy] = useState(false);

  const stepNum = Math.max(1, STEP_ORDER.indexOf(stepId) + 1);
  const totalSteps = STEP_ORDER.length;

  useEffect(() => {
    let alive = true;
    (async () => {
      setMeLoading(true);
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as MeResp;
        if (!alive) return;

        setMe(d);

        if (d?.authenticated && d?.onboarding?.completed) {
          router.replace(nextHref);
          return;
        }
        if (!d?.authenticated) {
          router.replace("/login");
          return;
        }
      } catch {
        if (!alive) return;
        router.replace("/login");
      } finally {
        if (alive) setMeLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, nextHref]);

  async function refreshMe() {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as MeResp;
      setMe(d);
    } catch {
      // ignore
    }
  }

  async function confirmAgeGate() {
    if (!needsAgeGate) return true;
    if (!ageOk) return false;

    setAgeBusy(true);
    setAgeErr(null);
    try {
      const r = await fetch("/api/auth/age/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        await refreshMe();
        return true;
      }
      setAgeErr(d?.error ? String(d.error) : "Age confirmation required");
      return false;
    } catch {
      setAgeErr("Age confirmation required");
      return false;
    } finally {
      setAgeBusy(false);
    }
  }

  async function nextFromWelcome() {
    const ok = await confirmAgeGate();
    if (!ok) return;
    setStepId("create_set");
  }

  async function createSet(info: { side: SideId; name: string }) {
    setSetBusy(true);
    setSetMsg(null);
    try {
      const colorBySide: Record<SideId, string> = { public: "blue", friends: "emerald", close: "rose", work: "slate" };
      const r = await fetch("/api/sets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ side: info.side, label: info.name, color: colorBySide[info.side], members: [] }),
      });
      const d = (await r.json().catch(() => ({}))) as SetsCreateResp;
      const item = d?.item;
      if (r.ok && d?.ok && item?.id) {
        setFirstSet({ id: item.id, name: info.name, side: info.side });
        setStepId("first_post");
        return;
      }
      setSetMsg(d?.error ? String(d.error) : "Could not create set");
    } catch {
      setSetMsg("Could not create set");
    } finally {
      setSetBusy(false);
    }
  }

  async function completeOnboarding() {
    setFinishBusy(true);
    try {
      const r = await fetch("/api/auth/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact_sync_done: false }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        router.replace(nextHref);
        return;
      }
      if (d?.error === "age_gate_required") {
        setStepId("welcome");
        setAgeErr(`Please confirm you meet the minimum age (${minAge}+).`);
        return;
      }
      router.replace(nextHref);
    } catch {
      router.replace(nextHref);
    } finally {
      setFinishBusy(false);
    }
  }

  if (meLoading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[500] animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center animate-spin shadow-2xl">
          <span className="text-white font-black text-2xl">S</span>
        </div>
        <h1 className="mt-10 text-xl font-black tracking-tight text-gray-900">Loading...</h1>
      </div>
    );
  }

  const setInfo = firstSet || { id: "", name: "My Set", side: "friends" as SideId };
  const footerBg = stepId === "first_post" ? SIDE_THEMES[setInfo.side].primaryBg : "bg-white";

  return (
    <div className="h-screen w-full bg-white flex flex-col overflow-hidden font-sans text-gray-900 select-none">
      {stepNum > 1 ? <ProgressDots step={stepNum} total={totalSteps} /> : null}

      <main className="flex-1 relative overflow-hidden">
        <StepWrapper active={stepId === "welcome"}>
          <WelcomeStep
            onNext={nextFromWelcome}
            onShowPrivacy={() => setShowPrivacy(true)}
            needsAgeGate={needsAgeGate}
            minAge={minAge}
            ageOk={ageOk}
            setAgeOk={setAgeOk}
            ageBusy={ageBusy}
            ageErr={ageErr}
          />
        </StepWrapper>

        <StepWrapper active={stepId === "create_set"} onBack={() => setStepId("welcome")}> 
          <CreateFirstSetStep onCreate={createSet} onSkip={completeOnboarding} busy={setBusy} msg={setMsg} />
        </StepWrapper>

        <StepWrapper active={stepId === "first_post"} onBack={() => setStepId("create_set")}> 
          <FirstPostStep
            setInfo={{ id: setInfo.id, name: setInfo.name, side: setInfo.side }}
            onPosted={completeOnboarding}
            onSkip={completeOnboarding}
            busy={finishBusy}
          />
        </StepWrapper>
      </main>

      {showPrivacy ? <PrivacyModal onClose={() => setShowPrivacy(false)} /> : null}

      <footer className={`h-24 flex items-center justify-center px-10 transition-colors duration-500 z-50 ${footerBg}`}>
        <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] ${stepId === "first_post" ? "text-white/20" : "text-gray-300"}`}>
          <Shield size={12} />
          <span>Context-safe Social OS</span>
        </div>
      </footer>
    </div>
  );
}
