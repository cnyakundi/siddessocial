"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  SlidersHorizontal,
  X,
  Info,
  ArrowRight,
  Mail,
} from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { NotificationsView } from "@/src/components/NotificationsView";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type TabId = "alerts" | "context";

function PublicUpdates(_: { onClose: () => void }) {
  // MVP: no Public updates surface here yet (Broadcasts removed).
  return null;
}

function ContextCard() {
  const { side } = useSide();
  const meta = SIDES[side];
  const theme = SIDE_THEMES[side];

  const bullets = useMemo(() => {
    if (side === "public") {
      return [
        {
          icon: SlidersHorizontal,
          title: "Tune Public",
          desc: "Trust Dial + Topics keep Public readable, not chaotic.",
          href: "/siddes-feed",
        },
        {
          icon: Shield,
          title: "Context Safety",
          desc: "Public is big. Stay scoped: use Topics + trust mode.",
          href: "/siddes-feed",
        },
        {
          icon: Users,
          title: "Channels",
          desc: "Calm public channels you trust.",
          href: "/siddes-feed",
        },
      ];
    }
    if (side === "work") {
      return [
        { icon: Users, title: "Sets (Teams)", desc: "Keep work streams separated by Set.", href: "/siddes-sets" },
        { icon: Mail, title: "Inbox", desc: "Work messages stay in Work Side.", href: "/siddes-inbox" },
      ];
    }
    return [
      { icon: Users, title: "Sets", desc: "Audience control inside your Side.", href: "/siddes-sets" },
      {
        icon: Shield,
        title: "Context Safety",
        desc: "This Side is a context. Posts don't leak across Sides.",
        href: "/siddes-feed",
      },
    ];
  }, [side]);

  return (
    <div className={cn("p-4 rounded-2xl border bg-white", theme.border)}>
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0", theme.primaryBg)}>
          <Shield size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-gray-900 truncate">{meta.label} Context</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {meta.desc || "Your current context. Audience stays explicit and safe."}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {bullets.map((b) => {
          const Icon = b.icon;
          return (
            <Link
              key={b.title}
              href={b.href}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-gray-900 truncate">{b.title}</div>
                <div className="text-xs text-gray-500 truncate">{b.desc}</div>
              </div>
              <ArrowRight size={16} className="text-gray-300" />
            </Link>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-gray-400 flex items-start gap-2">
        <Info size={14} className="mt-0.5" />
        <span>
          Siddes is different: privacy is structural. Your Side is always your audience anchor.
        </span>
      </div>
    </div>
  );
}

export function DesktopButlerTray({
  open,
  onClose,
  initialTab = "alerts",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: TabId;
}) {
  const { side } = useSide();
  const meta = SIDES[side];
  const theme = SIDE_THEMES[side];

  const [tab, setTab] = useState<TabId>(initialTab);

  useLockBodyScroll(open);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="desktop-butler-title" tabIndex={-1} className="relative h-full w-full max-w-[420px] bg-white shadow-2xl border-l border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="min-w-0">
            <div id="desktop-butler-title" className="text-sm font-extrabold text-gray-900 truncate">Activity</div>
            <div className={cn("text-[11px] font-extrabold uppercase tracking-widest", theme.text)}>
              {meta.label} Side
            </div>
          </div>

          <button
            type="button"
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            aria-label="Close tray"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3 border-b border-gray-100 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("alerts")}
            className={cn(
              "px-3 py-2 rounded-full text-xs font-extrabold",
              tab === "alerts"
                ? cn(theme.primaryBg, "text-white")
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Alerts
          </button>
          <button
            type="button"
            onClick={() => setTab("context")}
            className={cn(
              "px-3 py-2 rounded-full text-xs font-extrabold",
              tab === "context"
                ? cn(theme.primaryBg, "text-white")
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Context
          </button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100%-120px)]">
          {tab === "alerts" ? (
            <>
              <PublicUpdates onClose={onClose} />
              <NotificationsView embedded />
            </>
          ) : (
            <ContextCard />
          )}
        </div>
      </div>
    </div>
  );
}
