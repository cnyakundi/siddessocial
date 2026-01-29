"use client";

/* eslint-disable @next/next/no-img-element */

import React from "react";
import {
  Globe,
  Users,
  Star,
  Briefcase,
  ShieldCheck,
  MapPin,
  Link as LinkIcon,
  MessageSquare,
  Mic,
  Lock,
} from "lucide-react";

import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import type { PrismFacet } from "@/src/components/PrismProfile";

// sd_717_profile_v2_header: hero header for /u/[username] (Profile V2)
// sd_730_profile_v2_header_parity: headline + initials fallback + Close Vault access stat + pulse styling + message button + variant support

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

  viewerSidedAs?: SideId | null; // what the viewer shows them
  siders?: number | string | null; // number or "Close Vault"
  postsCount?: number;

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
    sharedSets,
    actions,
    messageHref,
    onMessage,
    messageDisabled,
  } = props;

  const theme = SIDE_THEMES[displaySide];
  const Icon = SIDE_ICON[displaySide];

  const name = (facet?.displayName || "").trim() || handle || "User";
  const headline = (facet?.headline || "").trim();
  const bio = (facet?.bio || "").trim();
  const location = (facet?.location || "").trim();
  const website = (facet?.website || "").trim();
  const coverImage = (facet?.coverImage || "").trim();
  const avatarImage = (String((facet as any)?.avatarImage || "") || "").trim();
  const pulse = facet?.pulse || null;

  const youShow = viewerSidedAs ? (SIDES[viewerSidedAs]?.label || viewerSidedAs) : "Public";
  const theyShow = SIDES[viewSide]?.label || viewSide;

  const showAccessStat = viewSide === "close" || typeof siders === "string";
  const shownPosts = typeof postsCount === "number" ? postsCount : undefined;

  if (variant === "clean") {
    return (
      <div className="w-full">
        <div className="flex flex-col items-center text-center pt-8 pb-6">
          <div
            className={cn(
              "w-28 h-28 rounded-full bg-gray-100 overflow-hidden shadow-sm flex items-center justify-center font-black text-2xl select-none ring-2",
              theme.ring
            )}
            aria-hidden="true"
            title={name}
          >
            {avatarImage ? <img src={avatarImage} alt="" className="w-full h-full object-cover" /> : initialsFrom(name)}
          </div>

          <h1 className="mt-5 text-2xl font-black text-gray-900 tracking-tight">{name}</h1>
          <div className="text-sm text-gray-500 font-semibold mt-1">{handle}</div>

          <div
            className={cn(
              "mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider",
              theme.lightBg,
              theme.border,
              theme.text
            )}
          >
            <Icon size={12} />
            {SIDES[displaySide].label} identity
          </div>

          {headline ? <div className="mt-3 text-sm font-semibold text-gray-700">{headline}</div> : null}

          <p className={cn("mt-4 text-[15px] leading-relaxed max-w-md", bio ? "text-gray-700" : "text-gray-400")}>
            {bio || "No bio yet."}
          </p>

          <div className="mt-4 inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold bg-gray-50 border-gray-100 text-gray-600">
            {SIDES[displaySide]?.isPrivate ? <Lock size={12} /> : <ShieldCheck size={12} />} {SIDES[displaySide]?.privacyHint || "Visible"}
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
            <div className="flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
              <ShieldCheck size={10} /> {SIDES[displaySide]?.privacyHint || "Visible"}
            </div>
          </div>

          {/* Directional clarity */}
          {!isOwner ? (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold", theme.lightBg, theme.border, theme.text)}>
                <ShieldCheck className="w-3.5 h-3.5" />
                They show you {theyShow}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold bg-gray-50 border-gray-200 text-gray-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                You show them {youShow}
              </div>
            </div>
          ) : null}

          {actions ? (
            <div className="mt-6 w-full max-w-sm">
              <div className="flex gap-3">
                <div className="flex-1">{actions}</div>
                {onMessage ? (
                  <button
                    type="button"
                    onClick={onMessage}
                    disabled={!!messageDisabled}
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
                ) : null}
              </div>
            </div>
          ) : null}

        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      {/* Hero cover */}
      <div
        className={cn(
          "relative h-[220px]",
          coverImage ? "bg-gray-900 bg-cover bg-center" : COVER_V2[displaySide]
        )}
        style={coverImage ? ({ backgroundImage: "url(" + coverImage + ")" } as any) : undefined}
      >
        {/* Soft fade into content */}
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white to-transparent" />

        {/* Safety pill */}
        <div className="absolute bottom-4 right-5">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 backdrop-blur shadow-sm border border-gray-100">
            <span className={cn("w-2.5 h-2.5 rounded-full", theme.primaryBg)} />
            <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest">
              Viewing as {SIDES[displaySide]?.label || displaySide}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 sm:px-6 -mt-10 pb-6">
        {/* Avatar */}
        <div className="relative">
          <div className="inline-block">
            <div className="p-1.5 bg-white rounded-3xl shadow-md">
              <div
                className={cn(
                  "w-24 h-24 rounded-[1.6rem] bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-100 font-black text-xl select-none"
                )}
                aria-hidden="true"
                title={name}
              >
                {avatarImage ? <img src={avatarImage} alt="" className="w-full h-full object-cover" /> : initialsFrom(name)}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1">
            <div className={cn("w-9 h-9 rounded-full bg-white shadow flex items-center justify-center border-4 border-white")}>
              <Icon className={cn("w-4 h-4", theme.text)} />
            </div>
          </div>
        </div>

        {/* Identity */}
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none truncate">{name}</h1>
            <div className="text-sm text-gray-500 font-semibold mt-1">{handle}</div>
            {headline ? <div className="text-sm text-gray-700 font-semibold mt-2">{headline}</div> : null}
          </div>

          {/* Identity chip */}
          <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border", theme.lightBg, theme.border)}>
            <Icon size={14} className={cn(theme.text)} />
            <span className={cn("text-[10px] font-extrabold uppercase tracking-wider", theme.text)}>
              {SIDES[displaySide]?.label || displaySide} identity
            </span>
          </div>
        </div>

        {/* Directional clarity */}
        {!isOwner ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold", theme.lightBg, theme.border, theme.text)}>
              <ShieldCheck className="w-3.5 h-3.5" />
              They show you {theyShow}
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold bg-gray-50 border-gray-200 text-gray-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              You show them {youShow}
            </div>
          </div>
        ) : null}

        {/* Bio */}
        <p className={cn("mt-4 text-[15px] leading-relaxed", bio ? "text-gray-700" : "text-gray-400")}>
          {bio || "No bio yet."}
        </p>

        {/* Meta */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 font-semibold">
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
          <div className="flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
            {SIDES[displaySide]?.isPrivate ? <Lock size={10} /> : <ShieldCheck size={10} />} {SIDES[displaySide]?.privacyHint || "Visible"}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 flex gap-8 pb-6 border-b border-gray-100">
          <div className="flex flex-col">
            <span className="text-lg font-black text-gray-900 leading-none tabular-nums">{shownPosts ?? "—"}</span>
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-1">Posts</span>
          </div>

          {showAccessStat ? (
            <div className="flex flex-col">
              <span className="text-lg font-black text-gray-900 leading-none tabular-nums">Close Vault</span>
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-1">Private Set</span>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="text-lg font-black text-gray-900 leading-none tabular-nums">{siders ?? "—"}</span>
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-1">Siders</span>
            </div>
          )}
        </div>

        {/* Actions (+ Message) */}
        {actions ? (
          <div className="mt-5">
            <div className="flex gap-3">
              <div className="flex-1">{actions}</div>
              {onMessage ? (
                <button
                  type="button"
                  onClick={onMessage}
                  disabled={!!messageDisabled}
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
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Shared Sets */}
        {sharedSets && sharedSets.length > 0 ? (
          <div className="mt-6">
            <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Shared Sets</div>
            <div className="flex flex-wrap gap-1.5">
              {sharedSets.slice(0, 8).map((s) => (
                <span
                  key={s}
                  className="px-2 py-1 rounded-full bg-gray-100 text-[10px] font-extrabold text-gray-700 border border-gray-200"
                  title="Shared Set"
                >
                  {s}
                </span>
              ))}
              {sharedSets.length > 8 ? (
                <span className="px-2 py-1 rounded-full bg-gray-50 text-[10px] font-extrabold text-gray-500 border border-gray-200">
                  +{sharedSets.length - 8}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Pulse */}
        {pulse && (pulse.label || pulse.text) ? (
          <div className="mt-6">
            <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">
              {displaySide === "public" ? "Recent Town Hall" : "Recent Pulse"}
            </div>
            <div className={cn("p-4 rounded-2xl bg-gray-50 border-l-4", theme.accentBorder)}>
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Mic size={10} /> {pulse.label || (displaySide === "public" ? "Town Hall" : "Pulse")}
              </div>
              <div className="text-sm font-extrabold text-gray-900">{pulse.text ? `“${pulse.text}”` : ""}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
