"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Inbox, Plus, Layers, User, Users, type LucideIcon } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDE_THEMES, type SideId } from "@/src/lib/sides";
import { getStoredLastPublicTopic, getStoredLastSetForSide } from "@/src/lib/audienceStore";

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
    <div className="relative flex flex-col items-center justify-center">
      <Link
        href="/siddes-profile"
        aria-label="Me"
        className={cn(
          "flex flex-col items-center justify-center gap-1 select-none active:scale-95 transition-transform",
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

      {/* Quick: People (1-tap) */}
      <Link
        href="/siddes-profile/people"
        aria-label="People"
        title="People"
        className={cn("absolute -top-2 right-0 p-3 active:scale-90 transition-transform", active ? "opacity-100" : "opacity-70")}
      >
        <span
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center bg-white border shadow-sm",
            active ? "border-gray-900" : "border-gray-200"
          )}
        >
          <Users size={12} strokeWidth={3} className="text-gray-700" />
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
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
  const sw = active ? 2.5 : 2;
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex flex-col items-center justify-center gap-1 select-none active:scale-95 transition-transform",
        active ? "text-gray-900" : "text-gray-400"
      )}
    >
      <Icon size={24} strokeWidth={sw} />
      <span className={cn("text-[9px] font-black uppercase tracking-tighter", active ? "opacity-100" : "opacity-60")}>
        {label}
      </span>
    </Link>
  );
}

/**
 * sd_494: Mobile Measurement Protocol v1.3 Toolbelt
 * Order: [Home] [Sets] [MAGIC PLUS] [Inbox] [Me]
 * - Tabs are neutral (black/gray). Only MAGIC PLUS uses Side color.
 * - Baseline height: 88px + safe-area padding.
 */
export function BottomNav() {
  const pathname = usePathname() || "";
  const { side } = useSide();
  const theme = SIDE_THEMES[side];

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

  const isHome = pathname === "/siddes-feed" || pathname.startsWith("/siddes-broadcasts");
  const isCompose = pathname.startsWith("/siddes-compose");
  const isSets = pathname.startsWith("/siddes-sets");
  const isInbox = pathname.startsWith("/siddes-inbox") || pathname.startsWith("/siddes-notifications");
  const isMe = pathname.startsWith("/siddes-profile") || pathname.startsWith("/siddes-settings");

  return (
    <nav
      aria-label="Daily tools"
      className="fixed bottom-0 left-0 right-0 z-[90] border-t border-gray-100 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.03)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-[430px] mx-auto px-4">
        <div className="h-[88px] grid grid-cols-5 items-start pt-2">
          <TabLink href="/siddes-feed" label="Home" Icon={Home} active={isHome} />

          {/* Sets are "Sets" in mobile UX language */}
          <TabLink href="/siddes-sets" label="Sets" Icon={Layers} active={isSets} />

          {/* MAGIC PLUS */}
          <Link
            href={createHref}
            aria-label="Create"
            className="flex flex-col items-center justify-center gap-1 select-none"
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
              <Plus size={32} strokeWidth={4} />
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
