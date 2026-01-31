"use client";

/* eslint-disable @next/next/no-img-element */

import React from "react";
import Link from "next/link";
import { Globe, Users, Star, Briefcase, ShieldCheck, Lock, MapPin, Link as LinkIcon, MessageSquare, Mic, Pin } from "lucide-react";

import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import type { PrismFacet } from "@/src/components/PrismProfile";

// sd_790_public_profile_header_polish
// Goal: make /u/<username> feel premium + calm (Threads-level cleanliness), without breaking existing props.

// sd_913_public_follow_counts: public followers/following stats in header

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function initialsFrom(nameOrHandle: string) {
  const s = (nameOrHandle || "").replace(/^@/, "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return (parts[0][0] || "U").toUpperCase();
  return ((parts[0][0] || "U") + (parts[parts.length - 1][0] || "U")).toUpperCase();
}

function safeWebsiteHref(website: string) {
  const w = (website || "").trim();
  if (!w) return "#";
  if (w.startsWith("http://") || w.startsWith("https://")) return w;
  return "https://" + w;
}

const SIDE_ICON: Record<SideId, React.ComponentType<any>> = {
  public: Globe,
  friends: Users,
  close: Star,
  work: Briefcase,
};

// Tailwind-safe static cover gradients (kept, but used subtly)
const COVER_V2: Record<SideId, string> = {
  public: "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600",
  friends: "bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600",
  close: "bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600",
  work: "bg-gradient-to-br from-slate-700 via-slate-800 to-black",
};

const NEUTRAL_COVER = "bg-gradient-to-br from-gray-50 via-white to-gray-100";

export type ProfileV2HeaderVariant = "hero" | "clean";

function Stat(props: { label: string; value: React.ReactNode; subtle?: boolean; href?: string; locked?: boolean }) {
  const { label, value, subtle, href, locked } = props;

  const Wrapper: any = href && !locked ? Link : "div";
  const wrapperProps: any = href && !locked ? { href, "aria-label": `Open ${label}`, title: `Open ${label}` } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "flex flex-col",
        subtle ? "opacity-80" : "",
        href && !locked ? "hover:opacity-90 active:opacity-80 transition-opacity" : "",
        locked ? "opacity-80 cursor-default" : ""
      )}
    >
      <span className="text-lg font-black text-gray-900 leading-none tabular-nums">{value}</span>
      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-1 inline-flex items-center gap-1">
        {label}
        {locked ? <Lock size={11} className="text-gray-300" /> : null}
      </span>
    </Wrapper>
  );
}

function PillsRow(props: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-gray-500">{props.children}</div>;
}

export function ProfileV2Header(props: {
  variant?: ProfileV2HeaderVariant;

  // The identity being displayed (theme, cover, safety pill)
  displaySide: SideId;

  // The relationship-granted side the viewer can see of them
  viewSide: SideId;

  handle: string;
  facet: PrismFacet;

  isOwner?: boolean;

  viewerSidedAs?: SideId | null; // what the viewer shows them
  siders?: number | string | null; // number or "Close Vault"
  postsCount?: number;

  // Public-only stats (shown when displaySide === public)
  publicFollowers?: number | null;
  publicFollowing?: number | null;

  sharedSets?: string[];

  // Action cluster (Side button, copy link, "more" etc)
  actions?: React.ReactNode;

  // Optional message button (viewer only)
  messageHref?: string | null;
  onMessage?: (() => void) | null;
  messageDisabled?: boolean;
}) {
  const {
    variant = "hero",
    displaySide,
    viewSide,
    handle,
    facet,
    isOwner,
    viewerSidedAs,
    siders,
    postsCount,
    publicFollowers,
    publicFollowing,
    sharedSets,
    actions,
    messageHref,
    onMessage,
    messageDisabled,
  } = props;

  const theme = SIDE_THEMES[displaySide];
  const Icon = SIDE_ICON[displaySide];

  const safeHandle = (handle || "").trim();
  const name = (String((facet as any)?.displayName || "").trim() || safeHandle.replace(/^@/, "").trim() || "User").trim();
  const headline = String((facet as any)?.headline || "").trim();
  const bio = String((facet as any)?.bio || "").trim();
  const location = String((facet as any)?.location || "").trim();
  const website = String((facet as any)?.website || "").trim();
  const coverImage = String((facet as any)?.coverImage || "").trim();
  const avatarImage = String((facet as any)?.avatarImage || "").trim();
  const pulse = (facet as any)?.pulse || null;

  const youShow = viewerSidedAs ? (SIDES[viewerSidedAs]?.label || viewerSidedAs) : "Public";
  const theyShow = SIDES[viewSide]?.label || viewSide;

  const showAccessStat = viewSide === "close" || typeof siders === "string";
  const shownPosts = typeof postsCount === "number" ? postsCount : undefined;
  const shownFollowers = typeof publicFollowers === "number" ? publicFollowers : undefined;
  const shownFollowing = typeof publicFollowing === "number" ? publicFollowing : undefined;
  const publicRostersHidden = displaySide === "public" ? !!((facet as any)?.publicRostersHidden) : false;
  const uSlug = (safeHandle || "").replace(/^@/, "").trim();
  const followersHref = uSlug ? `/u/${encodeURIComponent(uSlug)}/followers` : undefined;
  const followingHref = uSlug ? `/u/${encodeURIComponent(uSlug)}/following` : undefined;
  const shownSiders = typeof siders === "number" ? siders : typeof siders === "string" ? siders : undefined;

  const showRelationship = !isOwner && (viewSide !== "public" || !!viewerSidedAs);

  const privacyPill = (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-extrabold",
        "bg-white/90 backdrop-blur",
        "border-gray-200 text-gray-900"
      )}
      title={SIDES[displaySide]?.privacyHint || ""}
    >
      <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden />
      <span className="uppercase tracking-widest">{SIDES[displaySide]?.label || displaySide}</span>
      <span className="text-gray-300">•</span>
      <span className="inline-flex items-center gap-1 text-gray-600">
        {SIDES[displaySide]?.isPrivate ? <Lock size={12} /> : <ShieldCheck size={12} />}
        {SIDES[displaySide]?.privacyHint || "Visible"}
      </span>
    </div>
  );

    const canMessage = viewSide !== "public";
  // sd_953_can_message_guard
const ctaMessage = canMessage && onMessage ? (
    <button
      type="button"
      onClick={onMessage}
      disabled={!!messageDisabled}
      aria-disabled={!!messageDisabled}
      className={cn(
        "w-12 h-11 rounded-2xl bg-gray-100 text-gray-900 inline-flex items-center justify-center font-extrabold transition-colors",
        messageDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"
      )}
      aria-label="Message"
      title="Message"
    >
      <MessageSquare size={18} />
    </button>
  ) : canMessage && messageHref ? (
    <a
      href={messageHref}
      className="w-12 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-900 inline-flex items-center justify-center font-extrabold transition-colors"
      aria-label="Message"
      title="Message"
    >
      <MessageSquare size={18} />
    </a>
  ) : null;

  const metaLine = location || website ? (
    <PillsRow>
      {location ? (
        <div className="flex items-center gap-1 min-w-0">
          <MapPin size={14} /> <span className="truncate">{location}</span>
        </div>
      ) : null}
      {website ? (
        <a
          href={safeWebsiteHref(website)}
          target="_blank"
          rel="noreferrer"
          className={cn("flex items-center gap-1 font-extrabold hover:underline min-w-0", theme.text)}
        >
          <LinkIcon size={14} /> <span className="truncate">{website}</span>
        </a>
      ) : null}
    </PillsRow>
  ) : null;

  const relationship = showRelationship ? (
    <div className="mt-4 flex flex-wrap gap-2">
      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold", theme.lightBg, theme.border, theme.text)}>
        <ShieldCheck className="w-3.5 h-3.5" />
         {theyShow}
      </div>
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold bg-gray-50 border-gray-200 text-gray-700">
        <ShieldCheck className="w-3.5 h-3.5" />
         {youShow}
      </div>
    </div>
  ) : null;

  
    const stats = (() => {
    const isPublic = displaySide === "public";
    const sharedCount = Array.isArray(sharedSets) ? sharedSets.length : 0;
    const hasPublicCounts = isPublic && (typeof shownFollowers !== "undefined" || typeof shownFollowing !== "undefined");
    const hasCore =
      typeof shownPosts !== "undefined" ||
      typeof shownSiders !== "undefined" ||
      sharedCount > 0 ||
      hasPublicCounts;

    if (!hasCore) return null;

    return (
      <div className="mt-6 flex gap-8 pb-6 border-b border-gray-100">
        <Stat label="Posts" value={typeof shownPosts === "undefined" ? "—" : shownPosts} />
        {isPublic ? (
          <>
            <Stat label="Followers" value={typeof shownFollowers === "undefined" ? "—" : shownFollowers} subtle href={followersHref} locked={publicRostersHidden} />
            <Stat label="Following" value={typeof shownFollowing === "undefined" ? "—" : shownFollowing} subtle href={followingHref} locked={publicRostersHidden} />
          </>
        ) : showAccessStat ? (
          <Stat label="Private Set" value={typeof shownSiders === "string" ? shownSiders : "Close Vault"} subtle />
        ) : (
          <Stat label="Connected" value={typeof shownSiders === "undefined" ? "—" : shownSiders} />
        )}
        {!isPublic && sharedCount > 0 ? <Stat label="Shared Circles" value={sharedCount} subtle /> : null}
      </div>
    );
  })();
  const sharedSetsBlock = null;
const avatar = avatarImage ? (
    <img
      src={avatarImage}
      alt={name}
      className="w-24 h-24 rounded-full border-4 border-white object-cover bg-white shadow-md"
    />
  ) : (
    <div
      className={cn(
        "w-24 h-24 rounded-full border-4 border-white bg-white flex items-center justify-center font-black text-2xl select-none shadow-md",
        theme.lightBg,
        theme.text
      )}
      aria-label={name}
    >
      {initialsFrom(name || safeHandle)}
    </div>
  );

    // sd_914_pulseblock_define: keep compile green; pulse UI can be reintroduced later.
  const pulseBlock = null;

if (variant === "clean") {
    return (
      <div className="w-full">
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                {avatar}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-xl font-black text-gray-900 truncate">{name}</div>
                  {/* sd_948: privacy pill removed in clean variant */}
                </div>
                <div className="text-sm text-gray-500 font-semibold mt-1 truncate">{safeHandle}</div>
                {headline ? <div className="text-sm text-gray-700 font-semibold mt-2">{headline}</div> : null}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">{/* sd_948: header CTA removed (use actions row) */}</div>
          </div>

          <p className={cn("mt-4 text-[15px] leading-relaxed whitespace-pre-line", bio ? "text-gray-700" : "text-gray-400")}>
            {bio || "No bio yet."}
          </p>
{/* sd_948: relationship removed */}
          {/* sd_948: stats moved out of header */}

          {actions ? <div className="mt-5">{actions}</div> : null}

          {/* sd_947_hide_pulse */}
        </div>
      </div>
    );
  }

  // HERO (default)
  const cover = coverImage ? (
    <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
  ) : (
    <>
      <div className={cn("absolute inset-0", NEUTRAL_COVER)} />
      <div className={cn("absolute inset-0 opacity-25", COVER_V2[displaySide])} />
    </>
  );

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      <div className="relative h-36 sm:h-40">
        {cover}
        <div className="absolute inset-0 bg-black/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/0 to-white/0" />

        {/* viewer pill */}
        <div className="absolute bottom-4 right-4">{/* sd_953_remove_privacy_pill */}</div>

        {/* avatar */}
        <div className="absolute left-5 bottom-[-2.75rem]">
          <div className="relative">
            <div className="p-1.5 bg-white rounded-[2rem] shadow-md">{avatar}</div>
            <div className="absolute -bottom-2 -right-2">
              <div className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center border-4 border-white">
                <Icon className={cn("w-5 h-5", theme.text)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-14 px-5 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none truncate">{name}</h1>
            <div className="text-sm text-gray-500 font-semibold mt-1 truncate">{safeHandle}</div>
            {headline ? <div className="text-sm text-gray-700 font-semibold mt-2">{headline}</div> : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">{ctaMessage}</div>
        </div>

        <p className={cn("mt-4 text-[15px] leading-relaxed whitespace-pre-line", bio ? "text-gray-700" : "text-gray-400")}>
          {bio || "No bio yet."}
        </p>

        <div className="mt-4">{metaLine}</div>
        {relationship}
        {stats}

        {actions ? <div className="mt-5">{actions}</div> : null}

        {/* sd_947_hide_pulse */}
        {/* sd_947_hide_shared */}
      </div>
    </div>
  );
}



// sd_941_finish_sd940_hidden_rosters_ui
