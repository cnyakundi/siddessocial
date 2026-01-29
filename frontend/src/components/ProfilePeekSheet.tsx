"use client";

/* eslint-disable @next/next/no-img-element */
// sd_920_profile_peek: long-press author row on the feed to preview profile in-place (no navigation)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, ExternalLink, Globe, Lock, Users, X } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { toast } from "@/src/lib/toast";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

type Facet = {
  side?: SideId;
  displayName?: string;
  headline?: string;
  bio?: string;
  location?: string | null;
  website?: string | null;
  avatarImage?: string | null;
  pulse?: { label: string; text: string } | null;
};

type ProfileView = {
  ok?: boolean;
  error?: string;
  user?: { id: number; username: string; handle: string };
  viewSide?: SideId;
  requestedSide?: SideId;
  allowedSides?: SideId[];
  viewerAuthed?: boolean;
  isOwner?: boolean;
  facet?: Facet;
  siders?: number | string | null;
  viewerSidedAs?: SideId | null;
  sharedSets?: string[];
  posts?: { side: SideId; count: number; items: any[] };
  viewerFollows?: boolean;
  followers?: number | null;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function excerpt(s: string, n = 160) {
  const t = (s || "").trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

function initialsFrom(name?: string, handle?: string) {
  const base = (name && name.trim()) || (handle && handle.replace(/^@/, "").trim()) || "U";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] ? parts[0][0] : "U").toUpperCase();
  const a = parts[0][0] || "U";
  const b = parts[parts.length - 1][0] || "U";
  return (a + b).toUpperCase();
}

export function ProfilePeekSheet(props: {
  open: boolean;
  onClose: () => void;
  username: string;
  side: SideId;
  onOpenProfile?: () => void;
}) {
  const { open, onClose, username, side, onOpenProfile } = props;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ProfileView | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [followBusy, setFollowBusy] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState<number | null>(null);

  useLockBodyScroll(open && mounted);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open: open && mounted, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  const uname = useMemo(() => {
    const u = String(username || "").trim().replace(/^@/, "").split(/\s+/)[0];
    return u;
  }, [username]);

  useEffect(() => {
    if (!open || !mounted) return;
    setExpanded(false);
    setErr(null);
    setData(null);

    if (!uname) {
      setErr("missing_username");
      return;
    }

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const qs = `?side=${encodeURIComponent(side)}&limit=2`;
        const res = await fetch(`/api/profile/${encodeURIComponent(uname)}${qs}`, { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as ProfileView | null;

        if (!alive) return;

        setData(j || null);

        if (!res.ok) {
          const e = String((j as any)?.error || (res.status === 401 ? "restricted" : `http_${res.status}`));
          setErr(e);
        } else {
          setErr(null);
        }

        const f = Boolean((j as any)?.viewerFollows);
        setFollowing(f);
        const cnt = (j as any)?.followers;
        setFollowers(typeof cnt === "number" ? cnt : null);
      } catch {
        if (!alive) return;
        setErr("network_error");
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, mounted, uname, side]);

  const viewSide = (data?.viewSide || "public") as SideId;
  const requested = ((data as any)?.requestedSide || viewSide || side) as SideId;
  const allowedSides = Array.isArray((data as any)?.allowedSides) ? ((data as any)?.allowedSides as SideId[]) : ["public"];
  const facet = (data?.facet || null) as Facet | null;
  const uhandle = (data?.user?.handle || ("@" + uname)) as string;
  const displayName = String(facet?.displayName || data?.user?.username || uname || "User").trim();

  const theme = SIDE_THEMES[requested] || SIDE_THEMES.public;
  const sideMeta = SIDES[requested] || SIDES.public;

  const headline = String(facet?.headline || "").trim();
  const bio = String(facet?.bio || "").trim();
  const location = String(facet?.location || "").trim();
  const website = String(facet?.website || "").trim();
  const pulse = facet?.pulse || null;
  const sharedSets = Array.isArray((data as any)?.sharedSets) ? ((data as any)?.sharedSets as string[]) : [];
  const postsCount = typeof (data as any)?.posts?.count === "number" ? Number((data as any).posts.count) : null;

  const locked = Boolean(data && data.ok === false && (data as any).error === "locked");
  const restricted = Boolean(data && data.ok === false && (data as any).error === "restricted");

  const showMoreToggle = Boolean(
    headline ||
      bio ||
      location ||
      website ||
      (pulse && (pulse.label || pulse.text)) ||
      (sharedSets && sharedSets.length) ||
      (data && (data.viewerSidedAs || data.viewSide))
  );

  const canFollow = Boolean((data as any)?.viewerAuthed) && !Boolean((data as any)?.isOwner);
  const canToggleFollow = canFollow && !locked && !restricted;

  const goFullProfile = () => {
    onClose();
    try {
      onOpenProfile?.();
    } catch {}
  };

  const doToggleFollow = async () => {
    if (!uname) return;
    if (!canToggleFollow) return;
    if (followBusy) return;

    const want = !following;
    setFollowBusy(true);

    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "@" + uname, follow: want }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not update subscribe.";
        throw new Error(msg);
      }

      const next = Boolean(j.following);
      setFollowing(next);
      if (typeof j.followers === "number") setFollowers(j.followers);

      toast.success(next ? "Subscribed." : "Unsubscribed.");
    } catch (e) {
      toast.error((e as any)?.message || "Could not update subscribe.");
    } finally {
      setFollowBusy(false);
    }
  };

  if (!open || !mounted) return null;

  const SideIcon = requested === "public" ? Globe : requested === "friends" ? Users : Lock;

  return createPortal(
    <div className="fixed inset-0 z-[99] flex items-end justify-center md:items-center" data-testid="profile-peek-sheet">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onPointerDown={(e) => {
          // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click)
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="profile-peek-title"
        className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200 max-h-[78dvh] md:max-h-[82vh] overflow-y-auto overscroll-contain"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <div id="profile-peek-title" className="text-sm font-extrabold text-gray-900 truncate">
              Profile peek
            </div>
            <div className="text-xs text-gray-500 truncate">
              Hold-to-peek • {sideMeta.label} Side
            </div>
          </div>
          <button
            type="button"
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className={cn("p-4 rounded-2xl border", theme.border, theme.lightBg)}>
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
              {facet?.avatarImage ? (
                <img src={String(facet.avatarImage)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-sm font-black text-gray-800">{initialsFrom(displayName, uhandle)}</div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-black text-gray-900 truncate">{displayName}</div>
                <span className="text-xs font-bold text-gray-500 truncate">{uhandle}</span>
              </div>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-extrabold border",
                    theme.border,
                    "bg-white/70"
                  )}
                  aria-label={sideMeta.label}
                  title={sideMeta.label}
                >
                  <SideIcon size={12} className={theme.text} />
                  <span className={cn(theme.text)}>{sideMeta.label}</span>
                </span>

                {typeof followers === "number" ? (
                  <span className="text-[11px] font-bold text-gray-600">
                    {followers} {followers === 1 ? "subscriber" : "subscribers"}
                  </span>
                ) : null}

                {typeof postsCount === "number" ? (
                  <span className="text-[11px] font-bold text-gray-600">
                    {postsCount} {postsCount === 1 ? "post" : "posts"}
                  </span>
                ) : null}
              </div>

              {headline ? <div className="mt-2 text-sm font-semibold text-gray-800">{headline}</div> : null}

              {locked ? (
                <div className="mt-3 text-xs text-gray-600">
                  <span className="font-extrabold text-gray-800">Locked.</span>{" "}
                  You can’t view {SIDES[(((data as any)?.requestedSide as SideId | undefined) || (side as SideId))].label} unless they’ve placed you there.
                  <div className="mt-1 text-[11px] text-gray-500">
                    Allowed: {allowedSides.map((s) => SIDES[s as SideId].label).join(", ")}
                  </div>
                </div>
              ) : restricted ? (
                <div className="mt-3 text-xs text-gray-600">
                  <span className="font-extrabold text-gray-800">Sign in required.</span> This peek is private.
                </div>
              ) : null}
            </div>
          </div>

          {bio ? (
            <div className="mt-3 text-sm text-gray-800 leading-relaxed">
              {expanded ? bio : excerpt(bio, 190)}
            </div>
          ) : null}

          {showMoreToggle ? (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 text-xs font-extrabold text-gray-600 hover:text-gray-900"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Show less" : "Show more"}
            >
              {expanded ? (
                <>
                  Less <ChevronUp size={14} />
                </>
              ) : (
                <>
                  More <ChevronDown size={14} />
                </>
              )}
            </button>
          ) : null}
        </div>

        {expanded ? (
          <div className="mt-4 space-y-3">
            {(location || website) ? (
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
                <div className="text-xs font-extrabold text-gray-700 mb-2">Details</div>
                {location ? <div className="text-sm text-gray-800">📍 {location}</div> : null}
                {website ? (
                  <a
                    href={website.startsWith("http") ? website : ("https://" + website)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline"
                  >
                    <ExternalLink size={14} />
                    {website.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
              </div>
            ) : null}

            {pulse && (pulse.label || pulse.text) ? (
              <div className="p-4 rounded-2xl border border-gray-100 bg-white">
                <div className="text-xs font-extrabold text-gray-700 mb-1">{pulse.label || "Pulse"}</div>
                <div className="text-sm text-gray-800">{String(pulse.text || "").trim() || "—"}</div>
              </div>
            ) : null}

            {sharedSets && sharedSets.length ? (
              <div className="p-4 rounded-2xl border border-gray-100 bg-white">
                <div className="text-xs font-extrabold text-gray-700 mb-2">Shared Sets</div>
                <div className="flex flex-wrap gap-2">
                  {sharedSets.slice(0, 8).map((s) => (
                    <span
                      key={s}
                      className="px-2 py-1 rounded-full text-[11px] font-bold bg-gray-50 text-gray-700 border border-gray-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
              <div className="text-xs font-extrabold text-gray-700 mb-2">Context clarity</div>
              <div className="text-sm text-gray-800">
                They show you: <span className="font-extrabold">{SIDES[viewSide]?.label || "Public"}</span>
              </div>
              {(data as any)?.viewerSidedAs ? (
                <div className="text-sm text-gray-800 mt-1">
                  You show them:{" "}
                  <span className="font-extrabold">{SIDES[(data as any).viewerSidedAs as SideId]?.label || "Public"}</span>
                </div>
              ) : (
                <div className="text-sm text-gray-800 mt-1">
                  You show them: <span className="font-extrabold">Public</span>
                </div>
              )}
              <div className="mt-2 text-[11px] text-gray-500">Siddes stays directional — no access escalation.</div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            className={cn("w-full py-3 rounded-2xl font-extrabold border", theme.border, theme.lightBg, theme.text)}
            onClick={goFullProfile}
          >
            Open profile
          </button>

          {canFollow ? (
            <button
              type="button"
              onClick={doToggleFollow}
              disabled={!canToggleFollow || followBusy}
              className={cn(
                "w-full py-3 rounded-2xl font-extrabold border",
                canToggleFollow ? "border-gray-200 bg-white hover:bg-gray-50 text-gray-900" : "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
              )}
              aria-label={following ? "Unsubscribe" : "Subscribe"}
              title={locked ? "Locked" : restricted ? "Sign in required" : ""}
            >
              {followBusy ? "…" : following ? "Unsubscribe" : "Subscribe"}
            </button>
          ) : (
            <button
              type="button"
              className="w-full py-3 rounded-2xl font-extrabold border border-gray-200 bg-white hover:bg-gray-50 text-gray-900"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>

        {loading ? <div className="mt-4 text-xs text-gray-400">Loading…</div> : null}
        {err && !loading ? <div className="mt-2 text-xs text-gray-400">({err})</div> : null}
      </div>
    </div>,
    document.body
  );
}
