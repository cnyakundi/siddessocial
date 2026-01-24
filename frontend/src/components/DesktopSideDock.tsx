"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Users, Lock, Briefcase, Zap, Layers, MessageSquare, User as UserIcon, Plus } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_ORDER, SIDE_THEMES, type SideId } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const SIDE_ICONS: Record<SideId, React.ComponentType<any>> = {
  public: Globe,
  friends: Users,
  close: Lock,
  work: Briefcase,
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  active: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/siddes-feed",
    label: "Now",
    icon: Zap,
    active: (p) => p === "/siddes-feed" || p.startsWith("/siddes-feed/"),
  },
  {
    href: "/siddes-sets",
    label: "Sets",
    icon: Layers,
    active: (p) => p.startsWith("/siddes-sets"),
  },
  {
    href: "/siddes-inbox",
    label: "Inbox",
    icon: MessageSquare,
    active: (p) => p.startsWith("/siddes-inbox") || p.startsWith("/siddes-notifications"),
  },
  {
    href: "/siddes-profile",
    label: "Me",
    icon: UserIcon,
    active: (p) => p.startsWith("/siddes-profile"),
  },
];

function RailLink({ href, label, Icon, active }: { href: string; label: string; Icon: any; active: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "relative w-12 h-12 rounded-xl flex items-center justify-center transition-colors group",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20",
        active ? "text-gray-900" : "text-gray-300 hover:text-gray-900 hover:bg-gray-50"
      )}
    >
      {active ? <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[1.5px] h-8 bg-gray-900 rounded-r-full" /> : null}
      <Icon size={22} strokeWidth={active ? 2.5 : 2} />
      <div className="absolute left-14 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 shadow-xl">
        {label}
      </div>
    </Link>
  );
}

/**
 * DesktopSideDock (MVP skeleton rail)
 * - Top: brand mark
 * - Hero: Side switcher (Mode)
 * - Nav: Now / Sets / Inbox / Me
 * - Bottom: Create
 */
export function DesktopSideDock() {
  const pathname = usePathname() || "/";
  const { side, setSide, sideLock } = useSide();
  const lockedSide = sideLock?.enabled ? sideLock.side : null;
  const lockReason = sideLock?.enabled ? sideLock.reason : null;

  return (
    <aside className="w-[84px] h-screen sticky top-0 bg-white border-r border-gray-100 flex flex-col items-center">
      {/* Brand (matches Measurement Protocol baseline: 80px header) */}
      <div className="h-20 flex items-center justify-center">
        <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg select-none">
          S
        </div>
      </div>

      {/* Side switcher (Mode) */}
      <nav aria-label="Side" className="flex flex-col items-center gap-6 py-8 w-full">
        {SIDE_ORDER.map((id) => {
          const meta = SIDES[id];
          const t = SIDE_THEMES[id];
          const Icon = SIDE_ICONS[id];
          const isActive = id === side;
          const allowed = !lockedSide || id === lockedSide;

          return (
            <div key={id} className="relative w-full flex justify-center">
              {isActive ? <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[1.5px] h-8 bg-gray-900 rounded-r-full" /> : null}
              <button
                type="button"
                disabled={!allowed}
                onClick={() => {
                  if (!allowed) return;
                  setSide(id);
                }}
                aria-label={`${meta.label} Side`}
                aria-current={isActive ? "page" : undefined}
                title={`${meta.label} Side`}
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 relative group",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20",
                  !allowed ? "opacity-40 cursor-not-allowed" : null,
                  isActive ? cn(t.primaryBg, "text-white shadow-lg scale-110") : "bg-white text-gray-400 hover:bg-gray-50"
                )}
              >
                <Icon size={24} strokeWidth={2.5} fill={isActive ? "currentColor" : "none"} />
                {!allowed ? (
                  <span
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm"
                    title={lockReason || "Locked"}
                  >
                    <Lock size={10} className="text-gray-400" />
                  </span>
                ) : null}
                <div className="absolute left-16 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  {meta.label}
                </div>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Primary navigation */}
      <div className="flex flex-col items-center gap-2 w-full pb-6">
        {NAV.map((it) => (
          <RailLink key={it.href} href={it.href} label={it.label} Icon={it.icon} active={it.active(pathname)} />
        ))}
      </div>

      {/* Create */}
      <div className="mt-auto pb-8 flex flex-col items-center">
        <Link
          href={`/siddes-compose?side=${encodeURIComponent(side)}`}
          className="relative w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
          aria-label="Create"
          title="Create"
        >
          <Plus size={22} strokeWidth={2.5} />
          <div className="absolute left-14 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 shadow-xl">
            Create
          </div>
        </Link>
      </div>
    </aside>
  );
}
