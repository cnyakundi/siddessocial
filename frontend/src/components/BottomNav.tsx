"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Globe, Home, Inbox, Plus, Layers } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDE_THEMES } from "@/src/lib/sides";
import { getStoredLastNonPublicSide } from "@/src/lib/sideStore";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function NavLink({
  href,
  label,
  Icon,
  active,
  activeClassName,
  onClick,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: string | number; className?: string }>;
  active: boolean;
  activeClassName: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 select-none",
        active ? cn("text-gray-900", activeClassName) : "text-gray-500 hover:text-gray-700"
      )}
    >
      <Icon size={20} />
      <span className={cn("text-[10px] font-bold", active ? "text-gray-900" : "text-gray-500")}>{label}</span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname() || "";
  const { side, setSide } = useSide();
  const theme = SIDE_THEMES[side];

  const router = useRouter();

  const isFeed = pathname === "/siddes-feed";
  const isBroadcasts = pathname.startsWith("/siddes-broadcasts");
  const isCompose = pathname.startsWith("/siddes-compose");
  const isSets = pathname.startsWith("/siddes-sets");
  const isInbox = pathname.startsWith("/siddes-inbox") || pathname.startsWith("/siddes-notifications");

  const homeActive = isFeed && side !== "public";
  const publicActive = side === "public" && (isFeed || isBroadcasts);

  const goHome = (e?: React.MouseEvent<HTMLAnchorElement>) => {
    // If you're in Public, Home returns you to your last non-public Side.
    if (side !== "public") return;
    const last = getStoredLastNonPublicSide() || "friends";
    setSide(last);
  };

  const goPublic = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (side === "public") return;
    e.preventDefault();
    setSide("public", { afterConfirm: () => router.push("/siddes-feed") });
  };

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-[90] border-t border-gray-200 bg-white/90 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-2xl mx-auto px-4">
        <div className="h-16 grid grid-cols-5 items-center">
          <NavLink
            href="/siddes-feed"
            label="Home"
            Icon={Home}
            active={homeActive}
            activeClassName={theme.text}
            onClick={goHome}
          />

          <NavLink
            href="/siddes-feed"
            label="Public"
            Icon={Globe}
            active={publicActive}
            activeClassName={theme.text}
            onClick={goPublic}
          />

          {/* Create (context-aware) */}
          <Link
            href={`/siddes-compose?side=${side}`}
            aria-label="Create"
            className={cn(
              "group flex flex-col items-center justify-center gap-0.5 select-none",
              isCompose ? cn("text-gray-900", theme.text) : "text-gray-500 hover:text-gray-700"
            )}
            title="Create"
          >
            <span
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl ring-4 ring-white transform-gpu -translate-y-2 active:scale-95 transition-transform hover:opacity-95",
                "group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-gray-900/20",
                theme.primaryBg,
                isCompose ? "opacity-100" : ""
              )}
            >
              <Plus size={26} strokeWidth={3} />
            </span>
            <span className={cn("text-[10px] font-bold", isCompose ? "text-gray-900" : "text-gray-500")}>Create</span>
          </Link>

          <NavLink
            href="/siddes-sets"
            label="Sets"
            Icon={Layers}
            active={isSets}
            activeClassName={theme.text}
          />

          <NavLink
            href="/siddes-inbox"
            label="Inbox"
            Icon={Inbox}
            active={isInbox}
            activeClassName={theme.text}
          />
        </div>
      </div>
    </nav>
  );
}
