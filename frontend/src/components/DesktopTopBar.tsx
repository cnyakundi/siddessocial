"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Mail, Search } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { DesktopButlerTray } from "@/src/components/DesktopButlerTray";
import { DesktopUserMenu } from "@/src/components/DesktopUserMenu";
import { DesktopSearchOverlay } from "@/src/components/DesktopSearchOverlay";
import { useSideActivity } from "@/src/hooks/useSideActivity";
import { getStubViewerCookie } from "@/src/lib/stubViewerClient";
import { fetchMe } from "@/src/lib/authMe";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function titleFor(pathname: string): string {
  if (pathname === "/siddes-feed") return "Home";
  if (pathname.startsWith("/siddes-compose")) return "Compose";
  if (pathname.startsWith("/siddes-notifications")) return "Alerts";
  if (pathname.startsWith("/siddes-inbox")) return "Inbox";
  if (pathname.startsWith("/siddes-profile")) return "Me";
  if (pathname.startsWith("/siddes-settings")) return "Settings";
  if (pathname.startsWith("/siddes-sets")) return "Sets";
  if (pathname.startsWith("/siddes-invites")) return "Invites";
  if (pathname.startsWith("/siddes-broadcasts")) return "Broadcasts";
  if (pathname.startsWith("/siddes-moderation")) return "Moderation";
  if (pathname.startsWith("/search")) return "Search";
  return "";
}

function avatarLetter(viewer: string | null): string {
  const v = String(viewer || "").trim();
  if (!v) return "S";
  const clean = v.replace(/^@/, "");
  return (clean[0] || "S").toUpperCase();
}

function AvatarButton({ onClick, active, label }: { onClick: () => void; active: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-black text-sm text-gray-700 shadow-sm transition-all",
        active ? "ring-2 ring-gray-200" : "hover:border-gray-300"
      )}
      aria-label="Account"
      title="Account"
    >
      {label}
    </button>
  );
}

export function DesktopTopBar() {
  const pathname = usePathname() || "/";
  const title = useMemo(() => titleFor(pathname), [pathname]);
  const { side } = useSide();

  const meta = SIDES[side];
  const theme = SIDE_THEMES[side];

  const searchEnabled = true; // Search is real (/search)

  const [searchOpen, setSearchOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [trayTab, setTrayTab] = useState<"alerts" | "context">("alerts");
  const [menuOpen, setMenuOpen] = useState(false);
  const activity = useSideActivity(side);
  const [viewer, setViewer] = useState<string | null>(null);

  useEffect(() => {
    // Viewer badge from stub cookie (works in dev + stub universe; harmless in prod)
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
    <div className="sticky top-0 z-[90] bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="h-14 px-4 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className={cn("text-[11px] font-extrabold uppercase tracking-widest", theme.text)}>{meta.label}</span>
          <span className="text-gray-300">•</span>
          <span className="text-base font-bold text-gray-900 truncate">{title}</span>
        </div>

        {/* Utilities cluster */}
        <div className="relative flex items-center gap-3">
          {searchEnabled ? (
            <>
              {/* Scoped search field (desktop) */}
              <div className="relative hidden lg:block">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  readOnly
                  value=""
                  onFocus={() => setSearchOpen(true)}
                  onClick={() => setSearchOpen(true)}
                  placeholder={`Search in ${meta.label}…`}
                  className="bg-white text-sm px-4 py-2 pl-9 rounded-full w-56 border border-gray-200 transition-all outline-none focus:ring-2 focus:ring-gray-100 placeholder-gray-400 text-gray-700 shadow-sm cursor-pointer"
                  aria-label="Open search"
                />
              </div>

              {/* Fallback search button (smaller desktops) */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="lg:hidden p-2 rounded-full text-gray-600 hover:bg-gray-100"
                aria-label="Search"
                title="Search"
              >
                <Search size={18} />
              </button>
            </>
          ) : null}

          {/* Alerts bell (opens tray) */}
          <button
            type="button"
            onClick={() => {
              setTrayTab("alerts");
              setTrayOpen(true);
            }}
            className="relative p-2 rounded-full text-gray-600 hover:bg-gray-100"
            aria-label="Alerts"
            title="Alerts"
          >
            <Bell size={18} />
            {unreadHere > 0 ? (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
            ) : null}
          </button>

          {/* Inbox shortcut */}
          <Link
            href="/siddes-inbox"
            className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
            aria-label="Inbox"
            title="Inbox"
          >
            <Mail size={18} />
          </Link>

          {/* Avatar menu */}
          <div className="relative">
            <AvatarButton onClick={() => setMenuOpen((v) => !v)} active={menuOpen} label={avatarLetter(viewer)} />
            <DesktopUserMenu open={menuOpen} onClose={() => setMenuOpen(false)} align="right" />
          </div>
        </div>
      </div>

      {searchEnabled ? (
        <DesktopSearchOverlay
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          placeholder={`Search in ${meta.label}…`}
        />
      ) : null}

      <DesktopButlerTray open={trayOpen} onClose={() => setTrayOpen(false)} initialTab={trayTab} />
    </div>
  );
}
