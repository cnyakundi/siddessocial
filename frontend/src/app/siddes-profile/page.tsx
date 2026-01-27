"use client";

import Link from "next/link";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, ChevronRight, Globe, Star, Users } from "lucide-react";

import { useSide } from "@/src/components/SideProvider";
import { fetchMe, type MeResponse } from "@/src/lib/authMe";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { PrismFacet, PrismOwnerPayload } from "@/src/components/PrismProfile";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const SIDE_ICON: Record<SideId, React.ComponentType<{ className?: string }>> = {
  public: Globe,
  friends: Users,
  close: Star,
  work: Briefcase,
};

export default function SiddesProfileHomePage() {
  return (
    <Suspense fallback={<div className="px-4 py-4 text-xs text-gray-500">Loading…</div>}>
      <SiddesProfileHomeInner />
    </Suspense>
  );
}

/**
 * sd_543c: Me = Identity Editor Skeleton (MVP)
 * - Shows the active Side identity (Prism facet) in a calm, non-scoreboard layout.
 * - One primary action: Edit {Side} Identity (goes to /siddes-profile/prism).
 * - Secondary items: Privacy / Account / Help.
 * - Advanced tools hidden behind ?advanced=1 (Prism People link).
 */
function SiddesProfileHomeInner() {
  const { side, setSide } = useSide();
  const theme = SIDE_THEMES[side];

  const params = useSearchParams();
  const advanced = params.get("advanced") === "1";

  const [me, setMe] = useState<MeResponse | null>(null);
  const [prism, setPrism] = useState<PrismOwnerPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [meData, prismRes] = await Promise.all([
          fetchMe(),
          fetch("/api/prism", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        ]);

        if (!alive) return;

        setMe(meData);
        setPrism(prismRes && typeof prismRes === "object" ? (prismRes as any) : ({ ok: false, error: "bad_prism" } as any));
      } catch {
        if (!alive) return;
        setMe({ ok: false, authenticated: false } as any);
        setPrism({ ok: false, error: "network_error" } as any);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const authed = !!me?.authenticated;
  const username = me?.user?.username || "";
  const handle = username ? `@${username}` : "";

  const items = useMemo(() => (prism?.items || []).filter(Boolean) as PrismFacet[], [prism]);
  const facet = useMemo(() => {
    const f = items.find((x) => x.side === side);
    if (f) return f;
    return {
      side,
      displayName: "",
      headline: "",
      bio: "",
      location: "",
      website: "",
      coverImage: "",
      avatarImage: "",
      anthem: null,
      pulse: null,
      avatarMediaKey: null,
      updatedAt: null,
    } as any as PrismFacet;
  }, [items, side]);

  const displayName = (facet.displayName || "").trim() || (username ? username : "Me");
  const headline = (facet.headline || "").trim();
  const bio = (facet.bio || "").trim();

  const avatarUrl = (facet.avatarImage || "").trim();

  const Icon = SIDE_ICON[side];

  if (loading) {
    return <div className="p-4 text-xs text-gray-500">Loading profile…</div>;
  }

  if (!authed) {
    return (
      <div className="p-4">
        <div className="max-w-md mx-auto rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-sm font-black text-gray-900">Not signed in</div>
          <div className="text-xs text-gray-500 mt-1">Login to manage your identities.</div>
          <div className="mt-4">
            <Link href="/login" className="inline-flex px-4 py-2.5 rounded-xl text-sm font-extrabold bg-gray-900 text-white">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Identity Mirror */}
      <div className="flex flex-col items-center text-center py-10 border-b border-gray-100">
        {/* Mini Side switcher (for identity editing across Sides) */}
        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-full mb-8 border border-gray-100">
          {SIDE_ORDER.map((s) => {
            const t = SIDE_THEMES[s];
            const A = SIDE_ICON[s];
            const active = s === side;
            return (
              <button
                key={s}
                onClick={() => setSide(s)}
                title={SIDES[s].label}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                  active ? "bg-white shadow-sm scale-110 ring-1 ring-gray-100" : "hover:bg-white/60"
                )}
              >
                <A className={cn("w-4 h-4", active ? t.text : "text-gray-400")} />
              </button>
            );
          })}
        </div>

        {/* Avatar */}
        <div
          className={cn(
            "w-20 h-20 rounded-full overflow-hidden border flex items-center justify-center select-none",
            theme.border,
            theme.lightBg
          )}
          aria-label="Your avatar"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className={cn("text-2xl font-black", theme.text)} aria-hidden="true">
              {(displayName || "M").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-2xl font-black text-gray-900">{displayName}</div>
          {handle ? <div className="text-sm text-gray-400 mt-1">{handle}</div> : null}
        </div>

        {/* Side identity tag */}
        <div className={cn("mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider", theme.border, theme.lightBg, theme.text)}>
          <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />
          {SIDES[side].label} identity
        </div>

        {/* Headline + Bio */}
        <div className="mt-5 max-w-md px-2">
          {headline ? <div className="text-sm font-bold text-gray-900 mb-2">{headline}</div> : null}
          <div className="text-[15px] leading-relaxed text-gray-600">{bio || "Add a short bio for this Side."}</div>
        </div>

        {/* Primary action */}
        <Link
          href="/siddes-profile/prism"
          className="mt-7 inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-gray-200 bg-white text-sm font-extrabold hover:bg-gray-50 active:bg-gray-50 transition-colors"
        >
          Edit {SIDES[side].label} identity
        </Link>

        {/* Small privacy hint (truthful, no hype) */}
        <div className="mt-4 text-xs text-gray-400 flex items-center gap-2">
          <Icon className={cn("w-3.5 h-3.5", theme.text)} />
          <span>{SIDES[side].privacyHint}</span>
        </div>
      </div>

      {/* Secondary actions */}
      <div className="max-w-md mx-auto mt-8 space-y-1">
        <Link
          href="/privacy"
          className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 text-gray-700 hover:text-gray-900 font-semibold transition-colors"
        >
          Privacy <ChevronRight className="w-4 h-4 text-gray-300" />
        </Link>

        <Link
          href="/siddes-profile/account"
          className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 text-gray-700 hover:text-gray-900 font-semibold transition-colors"
        >
          Account <ChevronRight className="w-4 h-4 text-gray-300" />
        </Link>

        <Link
          href="/about"
          className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 text-gray-700 hover:text-gray-900 font-semibold transition-colors"
        >
          Help & Support <ChevronRight className="w-4 h-4 text-gray-300" />
        </Link>

        {advanced ? (
          <Link
            href="/siddes-profile/people"
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-900 font-semibold transition-colors"
          >
            Prism People <ChevronRight className="w-4 h-4 text-gray-300" />
          </Link>
        ) : null}
      </div>

      <div className="mt-10 text-center text-[11px] text-gray-300">
        Siddes v1 • {advanced ? "advanced" : "mvp"}
      </div>
    </div>
  );
}
