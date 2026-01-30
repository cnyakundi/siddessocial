"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CirclesMark } from "@/src/components/icons/CirclesMark";import { Home, Mail, User, Plus, Users as UsersIcon, Sparkles } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { SIDE_UX } from "@/src/lib/sideUx";
import { getSetsProvider } from "@/src/lib/setsProvider";
import type { SetDef } from "@/src/lib/sets";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function WorkspaceNavItem({
  href,
  label,
  icon: Icon,
  active,
  theme,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  active: boolean;
  theme: { lightBg: string; text: string; primaryBg: string };
}) {
  return (
    <Link
      href={href}
      className={cn(
        "w-full h-11 flex items-center gap-3 px-4 rounded-xl transition-colors",
        active ? cn(theme.lightBg, theme.text) : "text-gray-500 hover:bg-gray-50"
      )}
    >
      <Icon size={20} strokeWidth={2.5} />
      <span className="uppercase tracking-widest text-[11px] font-black">{label}</span>
      {active ? <span className={cn("ml-auto w-1.5 h-1.5 rounded-full", theme.primaryBg)} /> : null}
    </Link>
  );
}

/**
 * DesktopWorkspaceNav (Lane 2: Workspace Rail — 256px)
 * Measurement Protocol v1.2:
 * - Header baseline: 80px (h-20), px-6
 * - Nav items: h-11 (44px), rounded-xl, icon 20px, uppercase 11px tracking-widest
 * - Sets list padding: px-4
 * - Footer anchor: p-6 + border-t
 */
export function DesktopWorkspaceNav() {
  const pathname = usePathname() || "/";
  const { side } = useSide();
  const meta = SIDES[side];
  const theme = SIDE_THEMES[side];
  const ux = SIDE_UX[side];

  const setsProvider = useMemo(() => getSetsProvider(), []);
  const [sets, setSets] = useState<SetDef[]>([]);

  useEffect(() => {
    let alive = true;
    setsProvider
      .list({ side })
      .then((items) => {
        if (!alive) return;
        setSets(Array.isArray(items) ? items.slice(0, 6) : []);
      })
      .catch(() => {
        if (!alive) return;
        setSets([]);
      });

    return () => {
      alive = false;
    };
  }, [side, setsProvider]);

  return (
    <aside className="h-screen sticky top-0 bg-white border-r border-gray-100 flex flex-col">
      <header className="h-20 px-6 flex items-center border-b border-gray-50">
        <div className="flex flex-col">
          <h2 className={cn("text-lg font-black tracking-tighter uppercase leading-none", theme.text)}>{meta.label} Side</h2>
          <span className="text-[9px] text-gray-400 font-black uppercase tracking-[0.2em] mt-1">{ux.meaningShort}</span>
        </div>
      </header>

      <nav className="flex-1 p-4 space-y-2">
        <div className="mb-4 px-4 text-[10px] font-black text-gray-300 uppercase tracking-widest">Navigation</div>

        <WorkspaceNavItem href="/siddes-feed" label="Feed" icon={Home} active={pathname.startsWith("/siddes-feed")} theme={theme} />
        <WorkspaceNavItem href="/siddes-inbox" label="Inbox" icon={Mail} active={pathname.startsWith("/siddes-inbox")} theme={theme} />
        <WorkspaceNavItem href="/me" label="Me" icon={User} active={pathname.startsWith("/me") || (pathname.startsWith("/siddes-profile") && !pathname.startsWith("/siddes-profile/prism"))} theme={theme} />
        <WorkspaceNavItem href="/siddes-profile/prism" label="Prism" icon={Sparkles} active={pathname.startsWith("/siddes-profile/prism")} theme={theme} />
        <WorkspaceNavItem href="/siddes-sets" label="Circles" icon={CirclesMark} active={pathname.startsWith("/siddes-sets")} theme={theme} />

        <div className="mt-8 mb-4 px-4 text-[10px] font-black text-gray-300 uppercase tracking-widest">Groups</div>

        <div className="space-y-1">
          {sets.length ? (
            sets.map((s) => (
              <Link
                key={String(s.id)}
                href={`/siddes-sets/${encodeURIComponent(String(s.id))}`}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", theme.lightBg)}>
                  <UsersIcon size={16} className={theme.text} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-widest text-gray-700 truncate">{s.label}</div>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-4 py-2 text-xs font-bold text-gray-400">No groups yet.</div>
          )}

          <Link
            href="/siddes-sets"
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            Create Set
          </Link>
        </div>
      </nav>

      <footer className="p-6 border-t border-gray-50">
        <div className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-300">Context Locked</div>
        <div className="mt-2 text-xs text-gray-400 font-medium leading-relaxed">{meta.privacyHint}</div>
      </footer>
    </aside>
  );
}