"use client";

/* eslint-disable @next/next/no-img-element */

import React from "react";
import {
  Globe,
  Users,
  Star,
  Briefcase,
  ShieldCheck,
  Lock,
  MapPin,
  Link as LinkIcon,
  MessageSquare,
} from "lucide-react";

import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import type { PrismFacet } from "@/src/components/PrismProfile";

// sd_819_restore_profilev2header_compile_green
// Goal: stop build failures (broken JSX) while keeping the Profile V2 header UX intact.

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function safeWebsiteHref(website: string) {
  const w = (website || "").trim();
  if (!w) return "#";
  if (w.startsWith("http://") || w.startsWith("https://")) return w;
  return "https://" + w;
}

function initialsFrom(nameOrHandle: string) {
  const s = (nameOrHandle || "").replace(/^@/, "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return (parts[0][0] || "U").toUpperCase();
  return ((parts[0][0] || "U") + (parts[parts.length - 1][0] || "U")).toUpperCase();
}

const SIDE_ICON: Record<SideId, React.ComponentType<any>> = {
  public: Globe,
  friends: Users,
  close: Star,
  work: Briefcase,
};

// Tailwind-safe static cover gradients
const COVER_V2: Record<SideId, string> = {
  public: "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600",
  friends: "bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600",
  close: "bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600",
  work: "bg-gradient-to-br from-slate-700 via-slate-800 to-black",
};

export type ProfileV2HeaderVariant = "hero" | "clean";

export function ProfileV2Header(props: {
  variant?: ProfileV2HeaderVariant;

  // The identity being displayed (theme, cover, safety pill)
  displaySide: SideId;

  // The relationship-granted side the viewer can see of them
  viewSide: SideId;

  handle: string;
  facet: PrismFacet;

  isOwner?: boolean;
  viewerSidedAs?: SideId | null;

  siders?: number | string | null;
  postsCount?: number;
  sharedSets?: string[];

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
    sharedSets,
    actions,
    messageHref,
    onMessage,
    messageDisabled,
  } = props;

  const theme = SIDE_THEMES[displaySide];
  const SideIcon = SIDE_ICON[displaySide];

  const name = (facet?.displayName || "").trim() || (handle || "").replace(/^@/, "").trim() || "User";
  const bio = (facet?.bio || "").trim();
  const location = (facet?.location || "").trim();
  const website = (facet?.website || "").trim();
  const coverImage = (facet?.coverImage || "").trim();
  const avatarImage = (String((facet as any)?.avatarImage || "") || "").trim();

  const youShow = viewerSidedAs ? (SIDES[viewerSidedAs]?.label || viewerSidedAs) : "Public";
  const theyShow = SIDES[viewSide]?.label || viewSide;

  const statsPosts = typeof postsCount === "number" ? postsCount : undefined;
  const statsSiders =
    typeof siders === "number" ? String(siders) : (typeof siders === "string" ? siders : undefined);

  const privacyPill = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border",
        theme.lightBg,
        theme.border,
        theme.text
      )}
      title={SIDES[displaySide]?.privacyHint || ""}
    >
      <SideIcon size={14} />
      <span>{SIDES[displaySide]?.label || displaySide}</span>
      <span className="text-gray-300">•</span>
      <span className="inline-flex items-center gap-1">
        {SIDES[displaySide]?.isPrivate ? <Lock size={12} /> : <ShieldCheck size={12} />}
        {SIDES[displaySide]?.privacyHint || "Visible"}
      </span>
    </div>
  );

  const relationship = !isOwner ? (
    <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-gray-500">
      <span>
        They show you <span className="font-black text-gray-900">{theyShow}</span>
      </span>
      <span className="text-gray-300">•</span>
      <span>
        You show them <span className="font-black text-gray-900">{youShow}</span>
      </span>
    </div>
  ) : null;

  const avatar = avatarImage ? (
    <img
      src={avatarImage}
      alt={name}
      className="w-20 h-20 rounded-full border-4 border-white object-cover shadow-md"
    />
  ) : (
    <div
      className="w-20 h-20 rounded-full border-4 border-white bg-white/90 text-gray-900 flex items-center justify-center font-black text-2xl shadow-md"
      aria-label={name}
    >
      {initialsFrom(name || handle)}
    </div>
  );

  const cover = coverImage ? (
    <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
  ) : (
    <div className={cn("absolute inset-0", COVER_V2[displaySide])} />
  );

  const ctaMessage = onMessage ? (
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
  ) : messageHref ? (
    <a
      href={messageHref}
      className="w-12 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-900 inline-flex items-center justify-center font-extrabold transition-colors"
      aria-label="Message"
      title="Message"
    >
      <MessageSquare size={18} />
    </a>
  ) : null;

  const metaLine = (location || website) ? (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-gray-500">
      {location ? (
        <div className="flex items-center gap-1">
          <MapPin size={14} /> {location}
        </div>
      ) : null}
      {website ? (
        <a
          href={safeWebsiteHref(website)}
          target="_blank"
          rel="noreferrer"
          className={cn("flex items-center gap-1 font-extrabold hover:underline", theme.text)}
        >
          <LinkIcon size={14} /> {website}
        </a>
      ) : null}
    </div>
  ) : null;

  const stats = (statsPosts || statsSiders) ? (
    <div className="mt-3 flex items-center justify-center gap-4 text-xs font-semibold text-gray-600">
      {typeof statsPosts !== "undefined" ? (
        <div className="flex items-center gap-1">
          <span className="font-black text-gray-900 tabular-nums">{statsPosts}</span>
          <span>Posts</span>
        </div>
      ) : null}
      {typeof statsSiders !== "undefined" ? (
        <div className="flex items-center gap-1">
          <span className="font-black text-gray-900 tabular-nums">{statsSiders}</span>
          <span>Siders</span>
        </div>
      ) : null}
      {Array.isArray(sharedSets) && sharedSets.length ? (
        <div className="flex items-center gap-1">
          <span className="font-black text-gray-900 tabular-nums">{sharedSets.length}</span>
          <span>Shared</span>
        </div>
      ) : null}
    </div>
  ) : null;

  if (variant === "clean") {
    return (
      <div className="w-full">
        <div className={cn("rounded-3xl border overflow-hidden", theme.border)}>
          <div className={cn("px-5 py-5", theme.lightBg)}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {avatar}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-lg font-black text-gray-900 truncate">{name}</div>
                    {privacyPill}
                  </div>
                  <div className="text-xs font-bold text-gray-500 mt-0.5 truncate">{handle}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {ctaMessage}
              </div>
            </div>

            {bio ? <div className="mt-3 text-sm text-gray-800 leading-5 text-center">{bio}</div> : null}
            {metaLine}
            {relationship}
            {stats}

            {actions ? <div className="mt-5 flex justify-center">{actions}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  // HERO
  return (
    <div className="w-full">
      <div className={cn("rounded-3xl overflow-hidden border", theme.border)}>
        <div className="relative h-36 md:h-44">
          {cover}
          <div className="absolute inset-0 bg-black/15" />
          <div className="absolute left-5 bottom-[-2.5rem]">{avatar}</div>
        </div>

        <div className="pt-14 px-5 pb-5 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-xl font-black text-gray-900 truncate">{name}</div>
                {privacyPill}
              </div>
              <div className="text-xs font-bold text-gray-500 mt-0.5 truncate">{handle}</div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {ctaMessage}
            </div>
          </div>

          {bio ? <div className="mt-3 text-sm text-gray-800 leading-5">{bio}</div> : null}
          {metaLine}
          {relationship}
          {stats}

          {actions ? <div className="mt-5">{actions}</div> : null}
        </div>
      </div>

      {Array.isArray(sharedSets) && sharedSets.length ? (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {sharedSets.slice(0, 8).map((s) => (
            <div
              key={s}
              className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-gray-100 text-gray-700 border border-gray-200"
              title={s}
            >
              {s}
            </div>
          ))}
          {sharedSets.length > 8 ? (
            <div className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-gray-50 text-gray-500 border border-gray-100">
              +{sharedSets.length - 8}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
