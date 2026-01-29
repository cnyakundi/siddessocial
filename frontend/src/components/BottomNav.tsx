"use client";

// sd_785_tab_route_memory



// sd_763_standardize_alerts_label
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, MessageCircle, Plus, type LucideIcon } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDE_THEMES, type SideId } from "@/src/lib/sides";
import { getStoredLastPublicTopic, getStoredLastSetForSide } from "@/src/lib/audienceStore";
import { useNotificationsActivity } from "@/src/hooks/useNotificationsActivity";
import { useInboxActivity } from "@/src/hooks/useInboxActivity";

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

function MeTabLink({ href = "/siddes-profile", active, side }: { href?: string; active: boolean; side: SideId }) {
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
        href={href}
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
            aria-label={"New " + label}
          />
        ) : null}
        {showCount ? (
          <span
            className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white"
            aria-label={display + " unread " + label}
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


function TabButton({
  label,
  Icon,
  active,
  badge,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  const sw = active ? 2.5 : 2;
  const n = Number.isFinite(badge as any) ? Math.max(0, Math.floor(badge as any)) : 0;
  const showDot = n > 0 && n < 10;
  const showCount = n >= 10;
  const display = n > 99 ? "99+" : String(n);
  return (
    <button
      type="button"
      onClick={onClick}
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
            aria-label={"New " + label}
          />
        ) : null}
        {showCount ? (
          <span
            className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white"
            aria-label={display + " unread " + label}
          >
            {display}
          </span>
        ) : null}
      </div>
      <span className={cn("text-[9px] font-black uppercase tracking-tighter", active ? "opacity-100" : "opacity-60")}>
        {label}
      </span>
    </button>
  );
}

/**
 * sd_494: Mobile Measurement Protocol v1.3 Toolbelt
 * Order: [Feed] [Alerts] [MAGIC PLUS] [Inbox] [Me]
 * - Tabs are neutral (black/gray). Only MAGIC PLUS uses Side color.
 * - Baseline height: 88px + safe-area padding.
 */
export function BottomNav({ onToggleNotificationsDrawer, notificationsDrawerOpen = false }: { onToggleNotificationsDrawer?: () => void; notificationsDrawerOpen?: boolean } = {}) {
  const pathname = usePathname() || "";
  const { side } = useSide();
  const theme = SIDE_THEMES[side];
  const { unread } = useNotificationsActivity();
  const inbox = useInboxActivity();

  // sd_525: Create inherits the current room (Side + Set/Topic)
  // - If you are inside a specific Set hub, Create targets that Set
  // - Otherwise, it uses the last selected Set (private Sides) or Topic (Public)
  // Note: uses useEffect so localStorage reads never run during SSR
  const [createHref, setCreateHref] = useState<string>(`/siddes-compose?side=${encodeURIComponent(side)}`);

  // sd_785_tab_route_memory: FB-like tab stacks — return to the last route inside each tab.
  // Stored per-session in sessionStorage.
  const [tabHrefs, setTabHrefs] = useState<{ feed: string; alerts: string; inbox: string; me: string }>({
    feed: "/siddes-feed",
    alerts: "/siddes-notifications",
    inbox: "/siddes-inbox",
    me: "/siddes-profile",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fullPath = window.location.pathname + window.location.search;

    const classify = (path: string) => {
      if (path.startsWith("/siddes-inbox")) return "inbox";
      if (path.startsWith("/siddes-profile")) return "me";
      if (path.startsWith("/siddes-notifications")) return "alerts";
      if (path.startsWith("/siddes-feed") || path.startsWith("/siddes-post")) return "feed";
      return null;
    };

    const load = () => {
      try {
        const raw = window.sessionStorage.getItem("sd.tabroute.map.v1");
        if (!raw) return {};
        const j = JSON.parse(raw);
        return j && typeof j === "object" ? j : {};
      } catch {
        return {};
      }
    };

    const save = (j: any) => {
      try {
        window.sessionStorage.setItem("sd.tabroute.map.v1", JSON.stringify(j));
      } catch {
        // ignore
      }
    };

    const j: any = load();
    const tab = classify(fullPath);
    if (tab) {
      j[tab] = fullPath;
      j._ts = Date.now();
      save(j);
    }

    setTabHrefs({
      feed: typeof j.feed === "string" && j.feed.startsWith("/siddes-") ? j.feed : "/siddes-feed",
      alerts: typeof j.alerts === "string" && j.alerts.startsWith("/siddes-") ? j.alerts : "/siddes-notifications",
      inbox: typeof j.inbox === "string" && j.inbox.startsWith("/siddes-") ? j.inbox : "/siddes-inbox",
      me: typeof j.me === "string" && j.me.startsWith("/siddes-") ? j.me : "/siddes-profile",
    });
  }, [pathname]);


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

  const isHome = pathname === "/siddes-feed" || pathname.startsWith("/siddes-post");
  const isCompose = pathname.startsWith("/siddes-compose");
  const isNotifs = Boolean(notificationsDrawerOpen) || pathname.startsWith("/siddes-notifications");
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
          <TabLink href={tabHrefs.feed} label="Feed" Icon={Home} active={isHome} />

          {/* PWA/mobile: surface Alerts as first-class (swap out Sets tab) */}
          {onToggleNotificationsDrawer ? (
            <TabButton
              label="Alerts"
              Icon={Bell}
              active={isNotifs}
              badge={unread}
              onClick={() => onToggleNotificationsDrawer()}
            />
          ) : (
            <TabLink href={tabHrefs.alerts} label="Alerts" Icon={Bell} active={isNotifs} badge={unread} />
          )}

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

          <TabLink href={tabHrefs.inbox} label="Inbox" Icon={MessageCircle} active={isInbox} badge={inbox.unreadThreads} />

          <MeTabLink active={isMe} side={side} href={tabHrefs.me} />
        </div>
      </div>
    </nav>
  );
}
