"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Search } from "lucide-react";

import { SideBadge } from "@/src/components/SideBadge";
import { SideSwitcherSheet } from "@/src/components/SideSwitcherSheet";
import { PeekSheet } from "@/src/components/PeekSheet";
import { DesktopUserMenu } from "@/src/components/DesktopUserMenu";
import { DesktopSearchOverlay } from "@/src/components/DesktopSearchOverlay";

import { useSide } from "@/src/components/SideProvider";
import { useSideActivity } from "@/src/hooks/useSideActivity";
import { useNotificationsActivity } from "@/src/hooks/useNotificationsActivity";
import { SIDES } from "@/src/lib/sides";
import { SIDE_UX } from "@/src/lib/sideUx";
import { getStubViewerCookie } from "@/src/lib/stubViewerClient";
import { fetchMe } from "@/src/lib/authMe";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function avatarLetter(viewer: string | null): string {
  const v = String(viewer || "");
  if (!v) return "ME";
  return v[0].toUpperCase();
}

type MeResp = { viewerId?: string | null };

/**
 * AppTopBar (Mobile) — Measurement Protocol v1.3
 * - Header: h-16 + safe-area top
 * - SideBadge pill: h-11
 * - Utilities: 44x44 targets, icons 22px stroke 2
 * - Bell dot: deterministic unread notifications (neutral red)
 * - No fake meters
 */
export function AppTopBar(props: { onOpenNotificationsDrawer?: () => void } = {}) {
  const { onOpenNotificationsDrawer } = props;

  const { side, setSide } = useSide();

  const [open, setOpen] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Peek is DB-backed and safe in prod (sheet is optional affordance)
  const peekEnabled = true;
  const searchEnabled = true;

  const activity = useSideActivity(side);
  const notifs = useNotificationsActivity();
  const unreadAlerts = notifs?.unread || 0;

  const [viewer, setViewer] = useState<string | null>(null);

  useEffect(() => {
    try {
      fetchMe()
        .then((d: MeResp | null) => {
          const vid = d?.viewerId ? String(d.viewerId) : (getStubViewerCookie() || null);
          setViewer(vid);
        })
        .catch(() => setViewer(getStubViewerCookie() || null));
    } catch {
      setViewer(null);
    }
  }, []);

  const meaning = (SIDE_UX as any)?.[side]?.meaning || (SIDE_UX as any)?.[side]?.meaningShort || SIDES[side].desc;

  return (
    <div className="sticky top-0 z-[90] bg-white/90 backdrop-blur border-b border-gray-50 pt-[env(safe-area-inset-top)]">
      <div className="max-w-[430px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link
          href="/siddes-feed"
          className={cn(
            "w-9 h-9 rounded-xl text-white font-black text-lg flex items-center justify-center shrink-0 shadow-sm",
            "bg-gray-900"
          )}
          aria-label="Siddes Home"
          title="Siddes"
        >
          S
        </Link>

        {/* Airlock (Side) */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center leading-none">
          <SideBadge
            onClick={() => setOpen(true)}
            onLongPress={
              peekEnabled
                ? () => {
                    setOpen(false);
                    setPeekOpen(true);
                  }
                : undefined
            }
            className="shadow-sm"
          />
          <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.25em] text-gray-300 truncate max-w-[220px]">
            {meaning}
          </div>
        </div>

        {/* Actions */}
        <div className="relative flex items-center gap-1 shrink-0">
          {searchEnabled ? (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-11 h-11 rounded-xl inline-flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              aria-label="Search"
              title="Search"
            >
              <Search size={22} strokeWidth={2} />
            </button>
          ) : null}

          {/* Notifications (Bell) — opens drawer when available, otherwise links */}
          {onOpenNotificationsDrawer ? (
            <button
              type="button"
              onClick={onOpenNotificationsDrawer}
              className="relative w-11 h-11 rounded-xl inline-flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={22} strokeWidth={2} />
              {unreadAlerts > 0 ? (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white bg-red-500" />
              ) : null}
            </button>
          ) : (
            <Link
              href="/siddes-notifications"
              className="relative w-11 h-11 rounded-xl inline-flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={22} strokeWidth={2} />
              {unreadAlerts > 0 ? (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white bg-red-500" />
              ) : null}
            </Link>
          )}

          {/* Identity Mirror */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center font-black text-sm shadow-sm transition-all",
              "bg-gray-100 text-gray-700 border-gray-200",
              menuOpen ? "ring-2 ring-gray-200" : "hover:border-gray-300"
            )}
            aria-label="Account"
            title="Account"
          >
            {avatarLetter(viewer)}
          </button>

          <DesktopUserMenu open={menuOpen} onClose={() => setMenuOpen(false)} align="right" />
        </div>
      </div>

      <SideSwitcherSheet
        open={open}
        onClose={() => setOpen(false)}
        currentSide={side}
        activity={activity}
        onSwitch={(nextSide) => {
          setSide(nextSide);
          setOpen(false);
        }}
      />

      {peekEnabled ? <PeekSheet open={peekOpen} onClose={() => setPeekOpen(false)} sideId={side} /> : null}

      {searchEnabled ? (
        <DesktopSearchOverlay
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          placeholder={`Search in ${SIDES[side].label}…`}
        />
      ) : null}
    </div>
  );
}
