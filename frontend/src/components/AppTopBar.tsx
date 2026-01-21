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
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { getStubViewerCookie } from "@/src/lib/stubViewerClient";
import { fetchMe } from "@/src/lib/authMe";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function avatarLetter(viewer: string | null): string {
  const v = String(viewer || "").trim();
  if (!v) return "S";
  const clean = v.replace(/^@/, "");
  return (clean[0] || "S").toUpperCase();
}

export function AppTopBar() {
  const { side, setSide } = useSide();
  const theme = SIDE_THEMES[side];

  const [open, setOpen] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const peekEnabled = true; // Peek is DB-backed (safe in prod)
  const searchEnabled = true; // Search is real (/search)

  const activity = useSideActivity(side);
  const [viewer, setViewer] = useState<string | null>(null);

  useEffect(() => {
    try {
      fetchMe()
        .then((d) => setViewer((d && (d as any).viewerId) ? String((d as any).viewerId) : (getStubViewerCookie() || null)))
        .catch(() => setViewer(getStubViewerCookie() || null));
    } catch {
      setViewer(null);
    }
  }, []);
  const unreadHere = activity?.[side]?.unread || 0;

  return (
    <div className="sticky top-0 z-[90] bg-white/95 backdrop-blur border-b border-gray-100 pt-[env(safe-area-inset-top)]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link
          href="/siddes-feed"
          className={cn(
            "w-8 h-8 rounded-lg text-white font-black text-lg flex items-center justify-center shrink-0",
            theme.primaryBg
          )}
          aria-label="Siddes Home"
          title="Siddes"
        >
          S
        </Link>

        <div className="flex-1 min-w-0 flex justify-center">
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
        </div>

        <div className="relative flex items-center gap-1 shrink-0">
          {searchEnabled ? (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
              aria-label="Search"
              title="Search"
            >
              <Search size={20} />
            </button>
          ) : null}

          <Link
            href="/siddes-notifications"
            className="relative p-2 rounded-full text-gray-600 hover:bg-gray-100"
            aria-label="Alerts"
            title="Alerts"
          >
            <Bell size={20} />
            {unreadHere > 0 ? (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
            ) : null}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "w-9 h-9 rounded-full border flex items-center justify-center font-black text-sm shadow-sm transition-all",
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
