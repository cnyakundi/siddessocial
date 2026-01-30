"use client";


// sd_763_standardize_alerts_label
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Inbox, PenSquare, User, UserPlus, Users } from "lucide-react";

function cn(...parts: Array<string | undefined |false | null>) {
  return parts.filter(Boolean).join(" ");
}

const NAV = [
  { href: "/siddes-feed", label: "Feed", icon: Home },
  { href: "/siddes-compose", label: "Compose", icon: PenSquare },
  { href: "/siddes-notifications", label: "Alerts", icon: Bell },
  { href: "/siddes-inbox", label: "Inbox", icon: Inbox },
  { href: "/siddes-invites", label: "Invites", icon: UserPlus },
  { href: "/siddes-circles", label: "Sets", icon: Users },
  { href: "/siddes-profile", label: "Me", icon: User },
];

export function TopNav() {
  const path = usePathname() || "";

  return (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-[680px] mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {NAV.map((n) => {
          const active =
            path === n.href ||
            (n.href !== "/siddes-feed" && path.startsWith(n.href));
          const Icon = n.icon;

          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "px-3 py-2 rounded-full text-sm font-bold border flex items-center gap-2",
                active
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
            >
              <Icon size={16} />
              {n.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
