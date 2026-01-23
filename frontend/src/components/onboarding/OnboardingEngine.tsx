"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES } from "@/src/lib/sides";

import { ProgressDots, StepWrapper } from "@/src/components/onboarding/ui";
import PrivacyModal from "@/src/components/onboarding/PrivacyModal";

import WelcomeStep from "@/src/components/onboarding/steps/WelcomeStep";
import UsernameStep from "@/src/components/onboarding/steps/UsernameStep";
import SidesExplainerStep from "@/src/components/onboarding/steps/SidesExplainerStep";
import CreateFirstSetStep from "@/src/components/onboarding/steps/CreateFirstSetStep";

const AddPeopleStep = dynamic(() => import("@/src/components/onboarding/steps/AddPeopleStep"), { ssr: false });
const PrismPeopleStep = dynamic(() => import("@/src/components/onboarding/steps/PrismPeopleStep"), { ssr: false });
const FirstPostStep = dynamic(() => import("@/src/components/onboarding/steps/FirstPostStep"), { ssr: false });
const RetentionStep = dynamic(() => import("@/src/components/onboarding/steps/RetentionStep"), { ssr: false });

type StepId = "welcome" | "username" | "sides" | "create_set" | "add_people" | "prism_people" | "first_post" | "install";
const STEP_ORDER: StepId[] = ["welcome", "username", "sides", "create_set", "add_people", "prism_people", "first_post", "install"];

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
type SetsPatchResp = { ok: boolean; item?: SetItem; error?: string };

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

  const [handle, setHandle] = useState("");
  const [handleBusy, setHandleBusy] = useState(false);
  const [handleMsg, setHandleMsg] = useState<string | null>(null);

  const needsAgeGate = !Boolean(me?.ageGateConfirmed);
  const minAge = Number(me?.minAge || 13);

  const [ageOk, setAgeOk] = useState(false);
  const [ageBusy, setAgeBusy] = useState(false);
  const [ageErr, setAgeErr] = useState<string | null>(null);

  const [setBusy, setSetBusy] = useState(false);
  const [setMsg, setSetMsg] = useState<string | null>(null);
  const [firstSet, setFirstSet] = useState<{ id: string; name: string; side: SideId } | null>(null);
  const [contactSyncDone, setContactSyncDone] = useState(false);

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

        const uname = String(d?.user?.username || "").trim().toLowerCase();
        if (uname) setHandle(uname);
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
    setStepId("username");
  }

  async function saveHandle() {
    setHandleMsg(null);
    const desired = String(handle || "").trim().toLowerCase();
    if (!desired) return;

    const current = String(me?.user?.username || "").trim().toLowerCase();
    if (current && desired === current) {
      setStepId("sides");
      return;
    }

    setHandleBusy(true);
    try {
      const r = await fetch("/api/auth/username/set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: desired }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        await refreshMe();
        setStepId("sides");
        return;
      }
      setHandleMsg(d?.error ? String(d.error) : "Could not save handle");
    } catch {
      setHandleMsg("Could not save handle");
    } finally {
      setHandleBusy(false);
    }
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
        setStepId("add_people");
        return;
      }
      setSetMsg(d?.error ? String(d.error) : "Could not create set");
    } catch {
      setSetMsg("Could not create set");
    } finally {
      setSetBusy(false);
    }
  }

  async function applyMembersAndNext(payload: { handles: string[]; contactSyncDone: boolean }) {
    setContactSyncDone(!!payload.contactSyncDone);

    if (!firstSet) {
      setStepId("prism_people");
      return;
    }

    const handles = (payload.handles || []).map((h) => String(h || "").trim()).filter(Boolean);
    if (!handles.length) {
      setStepId("prism_people");
      return;
    }

    setFinishBusy(true);
    try {
      const r = await fetch(`/api/sets/${encodeURIComponent(firstSet.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ members: handles }),
      });
      const d = (await r.json().catch(() => ({}))) as SetsPatchResp;
      if (r.ok && d?.ok) {
        setStepId("prism_people");
        return;
      }
      setStepId("prism_people");
    } catch {
      setStepId("prism_people");
    } finally {
      setFinishBusy(false);
    }
  }

  async function completeOnboarding() {
    setFinishBusy(true);
    try {
      const r = await fetch("/api/auth/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact_sync_done: !!contactSyncDone }),
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

        <StepWrapper active={stepId === "username"} onBack={() => setStepId("welcome")}>
          <UsernameStep value={handle} setValue={setHandle} busy={handleBusy} msg={handleMsg} onNext={saveHandle} />
        </StepWrapper>

        <StepWrapper active={stepId === "sides"} onBack={() => setStepId("username")}>
          <SidesExplainerStep onNext={() => setStepId("create_set")} />
        </StepWrapper>

        <StepWrapper active={stepId === "create_set"} onBack={() => setStepId("sides")}>
          <CreateFirstSetStep onCreate={createSet} busy={setBusy} msg={setMsg} />
        </StepWrapper>

        <StepWrapper active={stepId === "add_people"} onBack={() => setStepId("create_set")}>
          <AddPeopleStep
            setName={setInfo.name}
            sideId={setInfo.side}
            onContinue={(payload: { handles: string[]; contactSyncDone: boolean }) => applyMembersAndNext(payload)}
            onSkip={() => setStepId("prism_people")}
          />
        </StepWrapper>


        <StepWrapper active={stepId === "prism_people"} onBack={() => setStepId("add_people")}>
          <PrismPeopleStep
            onContinue={(payload: { contactSyncDone: boolean }) => {
              setContactSyncDone((prev) => prev || !!payload.contactSyncDone);
              setStepId("first_post");
            }}
            onSkip={() => setStepId("first_post")}
          />
        </StepWrapper>

        <StepWrapper active={stepId === "first_post"} onBack={() => setStepId("prism_people")}>
          <FirstPostStep
            setInfo={firstSet ? { id: firstSet.id, name: firstSet.name, side: firstSet.side } : { id: "", name: "My Set", side: "friends" }}
            onPosted={() => setStepId("install")}
          />
        </StepWrapper>

        <StepWrapper active={stepId === "install"} onBack={() => setStepId("first_post")}>
          <RetentionStep onFinish={completeOnboarding} busy={finishBusy} />
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
