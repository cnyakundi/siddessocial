"use client";

/**
 * DesktopSideRail (sd_307)
 * Left rail is orientation + navigation only.
 * - Create
 * - Side switcher (Doorway moment)
 * - Primary nav: Feed, Sets, Inbox, Alerts
 * - Bottom: Me, More
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation"; import { Globe, Users, Lock, Briefcase, Plus, Settings, Home, Mail, User, Layers } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { useSideActivity } from "@/src/hooks/useSideActivity";
function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type IconType = React.ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
  absoluteStrokeWidth?: boolean;
}>;

const SIDE_ITEMS: Array<{ id: SideId; icon: IconType }> = [
  { id: "public", icon: Globe },
  { id: "friends", icon: Users },
  { id: "close", icon: Lock },
  { id: "work", icon: Briefcase },
];

// sd_469a: Desktop nav declutter — unify alerts into Inbox (keep UI simple)
const PRIMARY_NAV: Array<{ href: string; label: string; icon: IconType }> = [
  { href: "/siddes-feed", label: "Home", icon: Home },
  { href: "/siddes-sets", label: "Sets", icon: Layers },
  { href: "/siddes-inbox", label: "Inbox", icon: Mail },
];

export function DesktopSideRail() {
  const pathname = usePathname() || "/";
  const { side, setSide } = useSide();
  const activeTheme = SIDE_THEMES[side];

  const activity = useSideActivity(side);

  const requestSide = (next: SideId) => {
    setSide(next);
  };

  return (
    <aside className="hidden md:flex shrink-0 bg-white border-r border-gray-100 h-screen sticky top-0 z-[80] md:w-24 lg:w-[320px] xl:w-[360px]">
      {/* Slim rail (md..lg): icons + tooltips */}
      <div className="w-full pt-6 pb-4 flex flex-col items-center lg:hidden">
        {/* Brand mark */}
        <div className={cn("mb-4 font-black text-xl tracking-tight select-none", activeTheme.text)} aria-label="Siddes">
          S
        </div>

        {/* Create */}
        <Link
          href="/siddes-compose"
          className={cn(
            "w-20 h-11 rounded-xl flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-[0.98] transition",
            activeTheme.primaryBg,
            "text-white"
          )}
          aria-label={`Create a new post in ${SIDES[side].label}`}
          title={`Create in ${SIDES[side].label}`}
        >
          <span className="text-sm font-extrabold">Create</span>
          <Plus size={18} strokeWidth={3} />
        </Link>

        {/* Sides (Doorway moment) */}
        <nav aria-label="Context switcher" className="mt-6 flex flex-col gap-3">
          {SIDE_ITEMS.map((it) => {
            const meta = SIDES[it.id];
            const t = SIDE_THEMES[it.id];
            const Icon = it.icon;
            const isActive = it.id === side;
            const unread = activity?.[it.id]?.unread || 0;
            const showDot = !isActive && unread > 0;

            return (
              <button
                key={it.id}
                type="button"
                onClick={() => requestSide(it.id)}
                aria-label={`${meta.label} Side`}
                aria-current={isActive ? "page" : undefined}
                title={`${meta.label} Side`}
                className={cn(
                  "w-20 py-2 rounded-2xl transition-colors group",
                  isActive ? cn(t.lightBg, "border border-gray-100") : "hover:bg-gray-50"
                )}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mx-auto relative transition-all",
                    isActive
                      ? cn(t.primaryBg, "text-white shadow-sm")
                      : "bg-white text-gray-400 border border-gray-100 group-hover:text-gray-700"
                  )}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.6 : 2.2} />
                  {showDot ? <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" /> : null}
                </div>

                <div
                  className={cn(
                    "mt-1 text-[10px] font-extrabold uppercase tracking-widest",
                    isActive ? t.text : "text-gray-400 group-hover:text-gray-600"
                  )}
                >
                  {meta.label}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Primary nav */}
        <nav aria-label="Primary navigation" className="mt-6 flex flex-col items-center gap-2">
          {PRIMARY_NAV.map((n) => {
            const Icon = n.icon;
            const isActive = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                aria-label={n.label}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                  isActive ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon size={20} strokeWidth={2.4} />
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions: Me + More */}
        <div className="mt-auto flex flex-col items-center gap-2 pb-2">
          <Link
            href="/siddes-profile"
            aria-label="Me"
            title="Me"
            className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <User size={20} />
          </Link>

          <Link
            href="/siddes-settings"
            aria-label="More"
            title="More"
            className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings size={20} />
          </Link>
        </div>
      </div>

      {/* Wide rail (lg+): labeled sections */}
      <div className="hidden lg:flex w-full pt-6 pb-4 flex-col">
        {/* Brand */}
        <div className="px-5 mb-4 flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg text-white font-black text-xl flex items-center justify-center", activeTheme.primaryBg)}>S</div>
          <div className="min-w-0">
            <div className="font-black text-lg tracking-tight text-gray-900 leading-none">Siddes</div>
            <div className="text-[11px] text-gray-400 font-semibold truncate">Context-safe by design.</div>
          </div>
        </div>

        {/* Create */}
        <div className="px-5 mb-5">
          <Link
            href="/siddes-compose"
            className={cn(
              "w-full py-3 rounded-xl flex items-center justify-center gap-2 font-extrabold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition",
              activeTheme.primaryBg
            )}
            aria-label={`New post in ${SIDES[side].label}`}
            title={`Create in ${SIDES[side].label}`}
          >
            <Plus size={18} strokeWidth={3} />
            <span>New Post</span>
          </Link>
        </div>

        {/* Sides */}
        <div className="px-3">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Sides</div>
          <nav aria-label="Context switcher" className="space-y-1">
            {SIDE_ITEMS.map((it) => {
              const meta = SIDES[it.id];
              const t = SIDE_THEMES[it.id];
              const Icon = it.icon;
              const isActive = it.id === side;
              const unread = activity?.[it.id]?.unread || 0;

              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => requestSide(it.id)}
                  aria-label={`${meta.label} Side`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors",
                    isActive ? "bg-gray-100" : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        isActive ? cn(t.primaryBg, "text-white shadow-sm") : cn(t.lightBg, t.text, "border border-gray-100")
                      )}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.6 : 2.2} />
                    </div>
                    <div className="min-w-0">
                      <div className={cn("text-sm font-extrabold truncate", isActive ? "text-gray-900" : "text-gray-800")}>{meta.label}</div>
                      <div className="text-[11px] text-gray-400 truncate">{meta.desc}</div>
                    </div>
                  </div>

                  {!isActive && unread > 0 ? (
                    <span className="min-w-[22px] h-5 px-1 rounded-full bg-red-500 text-[10px] font-black text-white flex items-center justify-center">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : isActive ? (
                    <span className={cn("w-2 h-2 rounded-full", t.primaryBg)} />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Navigation */}
        <div className="px-3 mt-6">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Navigate</div>
          <div className="space-y-1">
            {PRIMARY_NAV.map((n) => {
              const Icon = n.icon;
              const isActive = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors",
                    isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center",
                      isActive ? "bg-white border border-gray-200" : "bg-gray-50 border border-gray-100"
                    )}
                  >
                    <Icon size={18} className={cn(isActive ? "text-gray-900" : "text-gray-500")} />
                  </div>
                  <div className="text-sm font-extrabold">{n.label}</div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer: Me + More */}
        <div className="mt-auto px-5 pt-6 border-t border-gray-50 flex items-center justify-between">
          <Link
            href="/siddes-profile"
            className="px-3 py-2 rounded-xl text-sm font-extrabold text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Me
          </Link>

          <Link
            href="/siddes-settings"
            className="px-3 py-2 rounded-xl text-sm font-extrabold text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            More
          </Link>
        </div>
      </div>
    </aside>
  );
}
