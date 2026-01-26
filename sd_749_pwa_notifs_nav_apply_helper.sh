#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d "frontend" || ! -d "backend" ]]; then
  echo "❌ Run this from your repo root (the folder that contains frontend/ and backend/)."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP=".backup_sd_749_pwa_notifs_nav_${STAMP}"
mkdir -p "$BACKUP"

FILES=(
  "frontend/src/components/BottomNav.tsx"
  "frontend/src/components/MobileSideTabsRow.tsx"
  "frontend/src/components/onboarding/steps/WelcomeStep.tsx"
  "frontend/src/components/onboarding/steps/SidesExplainerStep.tsx"
  "frontend/src/components/onboarding/steps/FirstPostStep.tsx"
  "docs/FIX_PWA_NOTIFICATIONS_NAV.md"
)

for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp "$f" "$BACKUP/$f"
  fi
done

echo "== sd_749_pwa_notifs_nav =="
echo "Backup: $BACKUP"

mkdir -p "frontend/src/components"
cat > "frontend/src/components/BottomNav.tsx" <<'EOF_FRONTEND_SRC_COMPONENTS_BOTTOMNAV_TSX'
"use client";


/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Inbox, Plus, type LucideIcon } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDE_THEMES, type SideId } from "@/src/lib/sides";
import { getStoredLastPublicTopic, getStoredLastSetForSide } from "@/src/lib/audienceStore";
import { useNotificationsActivity } from "@/src/hooks/useNotificationsActivity";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function initialsFromName(nameOrHandle: string) {
  const s = String(nameOrHandle || '').replace(/^@/, '').trim();
  if (!s) return 'U';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return (parts[0][0] || 'U').toUpperCase();
  return ((parts[0][0] || 'U') + (parts[parts.length - 1][0] || 'U')).toUpperCase();
}

function MeTabLink({ active, side }: { active: boolean; side: SideId }) {
  const [img, setImg] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>("U");

  useEffect(() => {
    let cancelled = false;
    const cacheKey = "__sd_prism_cache_v1";

    const applyPayload = (j: any) => {
      try {
        const items = Array.isArray(j?.items) ? j.items : [];
        const f = items.find((x: any) => x?.side === side) || null;
        const name = String(f?.displayName || j?.user?.username || "You");
        const av = (f?.avatarImage && String(f.avatarImage).trim()) || "";
        if (!cancelled) {
          setInitials(initialsFromName(name));
          setImg(av || null);
        }
      } catch {}
    };

    try {
      const raw = window.sessionStorage.getItem(cacheKey);
      if (raw) applyPayload(JSON.parse(raw));
    } catch {}

    fetch("/api/prism", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        try {
          window.sessionStorage.setItem(cacheKey, JSON.stringify(j));
        } catch {}
        applyPayload(j);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [side]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <Link
        href="/siddes-profile"
        aria-label="Me"
        className={cn(
          "w-full h-full flex flex-col items-center justify-center gap-1 rounded-2xl select-none active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20",
          active ? "text-gray-900" : "text-gray-400"
        )}
      >
        <div
          className={cn(
            "w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-black border-2",
            active ? "border-gray-900" : "border-transparent",
            img ? "bg-gray-100" : "bg-gray-200"
          )}
        >
          {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : initials}
        </div>
        <span className={cn("text-[9px] font-black uppercase tracking-tighter", active ? "opacity-100" : "opacity-60")}>
          Me
        </span>
      </Link>
    </div>
  );
}

function TabLink({
  href,
  label,
  Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  badge?: number;
}) {
  const sw = active ? 2.5 : 2;
  const n = Number.isFinite(badge as any) ? Math.max(0, Math.floor(badge as any)) : 0;
  const showDot = n > 0 && n < 10;
  const showCount = n >= 10;
  const display = n > 99 ? "99+" : String(n);
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "w-full h-full flex flex-col items-center justify-center gap-1 rounded-2xl select-none active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20",
        active ? "text-gray-900" : "text-gray-400"
      )}
    >
      <div className="relative">
        <Icon size={24} strokeWidth={sw} />
        {showDot ? (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white"
            aria-label="New notifications"
          />
        ) : null}
        {showCount ? (
          <span
            className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white"
            aria-label={display + " unread notifications"}
          >
            {display}
          </span>
        ) : null}
      </div>
      <span className={cn("text-[9px] font-black uppercase tracking-tighter", active ? "opacity-100" : "opacity-60")}>
        {label}
      </span>
    </Link>
  );
}

/**
 * sd_494: Mobile Measurement Protocol v1.3 Toolbelt
 * Order: [Now] [Alerts] [MAGIC PLUS] [Inbox] [Me]
 * - Tabs are neutral (black/gray). Only MAGIC PLUS uses Side color.
 * - Baseline height: 88px + safe-area padding.
 */
export function BottomNav() {
  const pathname = usePathname() || "";
  const { side } = useSide();
  const theme = SIDE_THEMES[side];
  const { unread } = useNotificationsActivity();

  // sd_525: Create inherits the current room (Side + Set/Topic)
  // - If you are inside a specific Set hub, Create targets that Set
  // - Otherwise, it uses the last selected Set (private Sides) or Topic (Public)
  // Note: uses useEffect so localStorage reads never run during SSR
  const [createHref, setCreateHref] = useState<string>(`/siddes-compose?side=${encodeURIComponent(side)}`);

  useEffect(() => {
    const base = `/siddes-compose?side=${encodeURIComponent(side)}`;
    let href = base;

    // Prefer the explicit Set context when on a Set page
    const m = pathname.match(/^\/siddes-sets\/([^\/]+)/);
    if (m && side !== "public") {
      try {
        const setId = decodeURIComponent(m[1] || "");
        if (setId) href = `${base}&set=${encodeURIComponent(setId)}`;
      } catch {}
      setCreateHref(href);
      return;
    }

    if (side === "public") {
      const topic = getStoredLastPublicTopic();
      if (topic) href = `${base}&topic=${encodeURIComponent(topic)}`;
    } else {
      const lastSet = getStoredLastSetForSide(side);
      if (lastSet) href = `${base}&set=${encodeURIComponent(lastSet)}`;
    }

    setCreateHref(href);
  }, [side, pathname]);

  const isHome = pathname === "/siddes-feed";
  const isCompose = pathname.startsWith("/siddes-compose");
  const isNotifs = pathname.startsWith("/siddes-notifications");
  const isInbox = pathname.startsWith("/siddes-inbox");
  const isMe = pathname.startsWith("/siddes-profile");

  return (
    <nav
      aria-label="Daily tools"
      className="fixed bottom-0 left-0 right-0 z-[90] border-t border-gray-100 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.03)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-[430px] mx-auto px-4">
        <div className="h-[88px] grid grid-cols-5 items-start pt-2">
          <TabLink href="/siddes-feed" label="Now" Icon={Home} active={isHome} />

          {/* PWA/mobile: surface Notifications as first-class (swap out Sets tab) */}
          <TabLink href="/siddes-notifications" label="Alerts" Icon={Bell} active={isNotifs} badge={unread} />

          {/* MAGIC PLUS */}
          <Link
            href={createHref}
            aria-label="Create"
            className="w-full h-full flex flex-col items-center justify-center gap-1 rounded-2xl select-none"
            title="Create"
          >
            <span
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl",
                "border-4 border-white ring-1 ring-gray-100",
                "transform-gpu -translate-y-6 active:scale-90 transition-transform",
                theme.primaryBg
              )}
            >
              <Plus size={32} strokeWidth={2.5} />
            </span>
            <span
              className={cn(
                "text-[9px] font-black uppercase tracking-tighter",
                isCompose ? "text-gray-900" : "text-gray-400",
                "opacity-70"
              )}
            >
              Create
            </span>
          </Link>

          <TabLink href="/siddes-inbox" label="Inbox" Icon={Inbox} active={isInbox} />

          <MeTabLink active={isMe} side={side} />
        </div>
      </div>
    </nav>
  );
}
EOF_FRONTEND_SRC_COMPONENTS_BOTTOMNAV_TSX
echo "PATCHED: frontend/src/components/BottomNav.tsx"

mkdir -p "frontend/src/components"
cat > "frontend/src/components/MobileSideTabsRow.tsx" <<'EOF_FRONTEND_SRC_COMPONENTS_MOBILESIDETABSROW_TSX'
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Globe, Users, Heart, Lock, Briefcase, type LucideIcon } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  // sd_749_pwa_notifs_nav: Close = Inner Circle (Heart), not a "lock" (security is already conveyed elsewhere)
  close: Heart,
  work: Briefcase,
};

/**
 * sd_483: Threshold Habit (mobile)
 * Make Side switching physically fast:
 * - Always visible on the core surfaces (feed/sets/inbox/post detail)
 * - All 4 Sides visible at once (no horizontal scrolling)
 * - 44px+ hit targets (h-11) and instant color feedback
 * - No cross-side activity hints (prevents "side bleeding" signals)
 *
 * Uses SideProvider's gateway (entering Public requires confirm).
 * sd_523: SideLock-aware (threads/sets) + correct sticky offset below AppTopBar.
 */
export function MobileSideTabsRow() {
  const pathname = usePathname() || "";
      const show =
    pathname.startsWith("/siddes-") &&
    !pathname.startsWith("/siddes-compose");

  const { side, setSide, sideLock } = useSide();
  const lockedSide = sideLock?.enabled ? sideLock.side : null;
  const lockReason = sideLock?.enabled ? sideLock.reason : null;

  const lockReasonLabel =
    lockReason === "thread" ? "Thread" :
    lockReason === "set" ? "Set" :
    lockReason ? String(lockReason) :
    null;

  if (!show) return null;

  return (
    <div
      className="sticky z-[85] bg-white/95 backdrop-blur border-b border-gray-100"
      // AppTopBar: safe-area + h-16 (64px)
      style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}
      data-testid="side-tabs-row"
    >
      <div className="max-w-[430px] mx-auto px-4 py-2">
        <div className="grid grid-cols-4 gap-2">
          {SIDE_ORDER.map((id) => {
            const theme = SIDE_THEMES[id];
            const Icon = SIDE_ICON[id];
            const isActive = side === id;
            const allowed = !lockedSide || id === lockedSide;

            return (
              <button
                key={id}
                type="button"
                disabled={!allowed}
                onClick={() => {
                  if (!allowed) return;
                  setSide(id);
                }}
                aria-label={`Switch to ${SIDES[id].label}`}
                aria-current={isActive ? "page" : undefined}
                title={SIDES[id].privacyHint}
                className={cn(
                  "h-11 w-full rounded-2xl border px-2 flex items-center justify-center gap-2",
                  "text-[11px] font-extrabold uppercase tracking-tight transition",
                  "active:scale-95",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20",
                  !allowed ? "opacity-45 cursor-not-allowed" : null,
                  isActive
                    ? cn(theme.lightBg, theme.border, theme.text, "shadow-sm")
                    : "bg-white border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200"
                )}
              >
                <span className={cn("w-1.5 h-5 rounded-full", theme.primaryBg)} aria-hidden />
                <Icon size={14} strokeWidth={2.5} aria-hidden />
                <span className="truncate">{SIDES[id].label}</span>

                {!allowed ? (
                  <span
                    className="ml-auto -mr-1 w-5 h-5 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm"
                    title={lockReasonLabel ? `Locked (${lockReasonLabel})` : "Locked"}
                    aria-hidden
                  >
                    <Lock size={10} strokeWidth={2.5} className="text-gray-400" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {lockedSide ? (
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">
            <Lock size={12} strokeWidth={2.5} className="text-gray-300" aria-hidden />
            <span>
              Locked to {SIDES[lockedSide].label}
              {lockReasonLabel ? ` • ${lockReasonLabel}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
EOF_FRONTEND_SRC_COMPONENTS_MOBILESIDETABSROW_TSX
echo "PATCHED: frontend/src/components/MobileSideTabsRow.tsx"

mkdir -p "frontend/src/components/onboarding/steps"
cat > "frontend/src/components/onboarding/steps/WelcomeStep.tsx" <<'EOF_FRONTEND_SRC_COMPONENTS_ONBOARDING_STEPS_WELCOMESTEP_TSX'
import { ArrowRight, Globe, Users, Heart, Lock, Briefcase, type LucideIcon } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { SIDE_UX } from "@/src/lib/sideUx";
import { PrimaryButton } from "@/src/components/onboarding/ui";

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  // sd_749_pwa_notifs_nav: Close = Inner Circle (Heart)
  close: Heart,
  work: Briefcase,
};

export default function WelcomeStep({
  onNext,
  onShowPrivacy,
  needsAgeGate,
  minAge,
  ageOk,
  setAgeOk,
  ageBusy,
  ageErr,
}: {
  onNext: () => void;
  onShowPrivacy: () => void;
  needsAgeGate: boolean;
  minAge: number;
  ageOk: boolean;
  setAgeOk: (v: boolean) => void;
  ageBusy: boolean;
  ageErr: string | null;
}) {
  return (
    <div className="flex flex-col min-h-full items-center justify-center text-center px-6 pt-16 pb-12 animate-in fade-in zoom-in-95 duration-700">
      <div className="w-20 h-20 bg-gray-900 rounded-[2rem] flex items-center justify-center shadow-2xl mb-8">
        <span className="text-3xl font-black text-white tracking-tighter">S</span>
      </div>

      <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-3 leading-[0.95]">Siddes</h1>
      <p className="text-base text-gray-500 font-semibold leading-relaxed mb-7 max-w-sm">
        Keep your worlds separate.
        <br />
        Switch Sides. No audience mistakes.
      </p>

      {/* Side preview (zero-tap learning) */}
      <div className="grid grid-cols-1 gap-2 w-full max-w-xs mb-7">
        {SIDE_ORDER.map((id) => {
          const theme = SIDE_THEMES[id];
          const Icon = SIDE_ICON[id];
          return (
            <div key={id} className={`flex items-center gap-3 p-3 rounded-3xl border ${theme.lightBg} ${theme.border}`}>
              <div className={`p-2.5 rounded-2xl ${theme.primaryBg} text-white shrink-0`}>
                <Icon size={18} strokeWidth={3} />
              </div>
              <div className="text-left">
                <div className={`font-black text-[10px] uppercase tracking-widest ${theme.text}`}>{SIDES[id].label}</div>
                <div className="text-[11px] text-gray-600 font-semibold leading-tight">{SIDE_UX[id]?.meaning}</div>
              </div>
            </div>
          );
        })}
      </div>

      {needsAgeGate ? (
        <div className="w-full max-w-xs mb-6 text-left">
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" className="mt-0.5" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
            <span>
              I confirm I'm at least <strong>{minAge}</strong> years old (or the minimum age required in my country).
            </span>
          </label>
          {ageErr ? <div className="mt-2 text-xs font-bold text-rose-600">{ageErr}</div> : null}
        </div>
      ) : null}

      <div className="w-full flex flex-col items-center gap-4">
        <PrimaryButton
          label={ageBusy ? "One sec..." : "Get started"}
          onClick={onNext}
          icon={ArrowRight}
          disabled={ageBusy || (needsAgeGate && !ageOk)}
        />

        <button
          onClick={onShowPrivacy}
          className="text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-gray-900 transition-colors"
        >
          How privacy works
        </button>
      </div>
    </div>
  );
}
EOF_FRONTEND_SRC_COMPONENTS_ONBOARDING_STEPS_WELCOMESTEP_TSX
echo "PATCHED: frontend/src/components/onboarding/steps/WelcomeStep.tsx"

mkdir -p "frontend/src/components/onboarding/steps"
cat > "frontend/src/components/onboarding/steps/SidesExplainerStep.tsx" <<'EOF_FRONTEND_SRC_COMPONENTS_ONBOARDING_STEPS_SIDESEXPLAINERSTEP_TSX'
import { Check, Globe, Users, Heart, Lock, Briefcase, type LucideIcon } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { SIDE_UX } from "@/src/lib/sideUx";
import { PrimaryButton } from "@/src/components/onboarding/ui";

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  // sd_749_pwa_notifs_nav: Close = Inner Circle (Heart)
  close: Heart,
  work: Briefcase,
};

export default function SidesExplainerStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col min-h-full items-center justify-center text-center px-6 pt-24 pb-12">
      <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-10 leading-tight">
        One Identity,
        <br />4 Sides.
      </h2>

      <div className="grid grid-cols-1 gap-3 w-full max-w-xs mb-12">
        {SIDE_ORDER.map((id) => {
          const theme = SIDE_THEMES[id];
          const Icon = SIDE_ICON[id];
          return (
            <div key={id} className={`flex items-center gap-4 p-4 rounded-3xl border transition-all ${theme.lightBg} ${theme.border}`}>
              <div className={`p-2.5 rounded-2xl ${theme.primaryBg} text-white shrink-0`}>
                <Icon size={20} strokeWidth={3} />
              </div>
              <div className="text-left">
                <div className={`font-black text-sm uppercase tracking-widest ${theme.text}`}>{SIDES[id].label}</div>
                <div className="text-[11px] text-gray-600 font-semibold leading-tight">{SIDE_UX[id].meaning}</div>
                <div className="text-[10px] text-gray-400 font-bold leading-tight mt-0.5">{SIDES[id].privacyHint}</div>
              </div>
            </div>
          );
        })}
      </div>

      <PrimaryButton label="Got it" onClick={onNext} icon={Check} />
    </div>
  );
}
EOF_FRONTEND_SRC_COMPONENTS_ONBOARDING_STEPS_SIDESEXPLAINERSTEP_TSX
echo "PATCHED: frontend/src/components/onboarding/steps/SidesExplainerStep.tsx"

mkdir -p "frontend/src/components/onboarding/steps"
cat > "frontend/src/components/onboarding/steps/FirstPostStep.tsx" <<'EOF_FRONTEND_SRC_COMPONENTS_ONBOARDING_STEPS_FIRSTPOSTSTEP_TSX'
import { useState } from "react";
import { Camera, Globe, Users, Heart, Lock, Briefcase, type LucideIcon } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";

type PostCreateResp = { ok: boolean; item?: unknown; error?: string };

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  // sd_749_pwa_notifs_nav: Close = Inner Circle (Heart)
  close: Heart,
  work: Briefcase,
};

export default function FirstPostStep({
  setInfo,
  onPosted,
  onSkip,
  busy,
}: {
  setInfo: { id: string; name: string; side: SideId };
  onPosted: () => void;
  onSkip?: () => void;
  busy?: boolean;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const theme = SIDE_THEMES[setInfo.side || "friends"];
  const SideIcon = SIDE_ICON[setInfo.side || "friends"];
  const finishing = Boolean(busy);

  async function post() {
    const v = String(text || "").trim();
    if (!v || posting || finishing) return;
    setErr(null);
    setPosting(true);
    try {
      const r = await fetch("/api/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: v, setId: setInfo.id, side: setInfo.side }),
      });
      const d = (await r.json().catch(() => ({}))) as PostCreateResp;
      if (r.ok && d?.ok) {
        onPosted();
        return;
      }
      setErr(d?.error ? String(d.error) : "Could not post");
    } catch {
      setErr("Could not post");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={`flex flex-col min-h-full ${theme.primaryBg} transition-colors p-8 animate-in fade-in duration-700 pb-12`}>
      <div className="mt-16 mb-8 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="text-center md:text-left">
            <h2 className="text-5xl font-black text-white tracking-tight mb-2 leading-[0.85]">First Take</h2>
            <p className="text-white/80 font-bold text-lg">Post your first context-safe update.</p>
          </div>

          {onSkip ? (
            <button
              onClick={onSkip}
              disabled={posting || finishing}
              className={`text-[10px] font-black uppercase tracking-widest transition-colors ${posting || finishing ? "text-white/20 cursor-not-allowed" : "text-white/70 hover:text-white"}`}
              aria-label="Skip"
            >
              Skip
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[3.5rem] p-8 shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
        <div className="flex gap-2 mb-8 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${theme.lightBg} ${theme.text} ${theme.border} text-[10px] font-black uppercase tracking-widest shadow-sm`}>
            <SideIcon size={12} strokeWidth={3} /> {SIDES[setInfo.side].label}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-100 bg-gray-50 text-gray-500 text-[10px] font-black uppercase tracking-widest shadow-sm">
            {setInfo.name}
          </div>
        </div>

        <textarea
          autoFocus
          placeholder={`Say hi to ${setInfo.name}...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 w-full text-2xl font-bold text-gray-900 placeholder-gray-100 outline-none resize-none leading-relaxed no-scrollbar"
        />

        {err ? <div className="mt-3 text-xs font-bold text-rose-600">{err}</div> : null}

        <div className="flex justify-between items-center pt-6 border-t border-gray-50 shrink-0">
          <button type="button" className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:text-gray-900 transition-colors" aria-label="Add media">
            <Camera size={24} />
          </button>
          <button
            type="button"
            onClick={post}
            disabled={!text.trim() || posting || finishing}
            className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
              text.trim() && !posting && !finishing ? `${theme.primaryBg} text-white shadow-xl hover:scale-105 active:scale-95` : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }`}
          >
            {posting ? "Posting..." : finishing ? "Finishing..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
EOF_FRONTEND_SRC_COMPONENTS_ONBOARDING_STEPS_FIRSTPOSTSTEP_TSX
echo "PATCHED: frontend/src/components/onboarding/steps/FirstPostStep.tsx"

mkdir -p "docs"
cat > "docs/FIX_PWA_NOTIFICATIONS_NAV.md" <<'EOF_DOCS_FIX_PWA_NOTIFICATIONS_NAV_MD'
# FIX: PWA — Bottom Nav Alerts (swap out Sets) + Unread Badge + Close icon clarity

**Overlay:** sd_749_pwa_notifs_nav
**Date:** 2026-01-26

## Goal
Make **Notifications** (Alerts) visible on PWA/mobile by promoting them to the **BottomNav**, while keeping icon language unambiguous:
- Replace the **Sets** tab in the bottom nav with **Alerts**.
- Show a deterministic **unread badge** on the Alerts bell.
- Change the **Close Side icon** to a **Heart** (Inner Circle) so it can’t be mistaken for any “notifications/lock/system” meaning.

## What changed
### 1) BottomNav: Sets → Alerts
- Mobile/PWA bottom nav order is now:
  - **Now · Alerts · Create · Inbox · Me**
- Alerts tab links to `/siddes-notifications`.
- Added an unread badge driven by `useNotificationsActivity()`:
  - **1–9**: dot badge
  - **10+**: numeric badge (caps at `99+`)

### 2) Close Side icon: Lock → Heart
- The **Close** Side is “Inner Circle”, so the icon is now consistently a **Heart** across mobile + onboarding.

## Files changed
- `frontend/src/components/BottomNav.tsx`
- `frontend/src/components/MobileSideTabsRow.tsx`
- `frontend/src/components/onboarding/steps/WelcomeStep.tsx`
- `frontend/src/components/onboarding/steps/SidesExplainerStep.tsx`
- `frontend/src/components/onboarding/steps/FirstPostStep.tsx`

## Notes
- Sets are still available on mobile via **Account** (`/siddes-profile/account`) and by direct route (`/siddes-sets`).
- Notifications page already exists at `/siddes-notifications` and includes:
  - Push preferences + push subscription debug
  - DB-backed Alerts list (`NotificationsView`) with “Mark all read”

## Smoke test
1) **PWA/mobile:** confirm bottom nav shows **Alerts** (bell) instead of Sets.
2) Generate an unread alert (mention/reply), then confirm:
   - Alerts tab shows a dot (1–9) or a number (10+).
3) Open `/siddes-notifications`:
   - “Mark all read” clears the badge.
4) Open the Side tabs row (where visible):
   - **Close** uses a **Heart** icon (not a lock).
EOF_DOCS_FIX_PWA_NOTIFICATIONS_NAV_MD
echo "PATCHED: docs/FIX_PWA_NOTIFICATIONS_NAV.md"

echo ""
echo "✅ sd_749_pwa_notifs_nav applied."
echo "Backup: $BACKUP"
echo ""
echo "Next (VS Code terminal):"
echo "  ./verify_overlays.sh"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  cd .. && ./scripts/run_tests.sh"

