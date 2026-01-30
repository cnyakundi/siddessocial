"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Check, Search as SearchIcon } from "lucide-react";

import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_ORDER, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import type { SetDef, SetId } from "@/src/lib/sets";
import { getSetsProvider } from "@/src/lib/setsProvider";
import {
  emitAudienceChanged,
  getStoredLastSetForSide,
  setStoredLastSetForSide,
  subscribeAudienceChanged,
} from "@/src/lib/audienceStore";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function titleFor(pathname: string): string {
  if (pathname.startsWith("/siddes-sets")) return "Groups";
    if (pathname.startsWith("/siddes-notifications")) return "Alerts";
  if (pathname.startsWith("/siddes-inbox")) return "Inbox";
  if (pathname.startsWith("/siddes-profile/prism")) return "Identity";
  if (pathname.startsWith("/siddes-profile/account")) return "Account";
  if (pathname.startsWith("/siddes-profile/people")) return "People";
if (pathname.startsWith("/me")) return "Me";
  if (pathname.startsWith("/siddes-profile")) return "Me";
  if (pathname.startsWith("/siddes-compose")) return "Create";
  if (pathname.startsWith("/siddes-search") || pathname.startsWith("/search")) return "Search";
  return "";
}

function SidePopover({
  open,
  onClose,
  currentSide,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  currentSide: SideId;
  onPick: (side: SideId) => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[95]"
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className="absolute top-12 left-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-[100] py-2 animate-in fade-in zoom-in-95 duration-100">
        <div className="px-4 py-2">
          <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Side</div>
          <div className="text-[10px] font-semibold text-gray-400 mt-0.5">Side = who this is for.</div>
        </div>
        {SIDE_ORDER.map((id) => {
          const t = SIDE_THEMES[id];
          const isActive = currentSide === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm font-medium flex justify-between items-center group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("w-2 h-2 rounded-full", t.primaryBg)} />
                <span className={cn("truncate", isActive ? "text-gray-900 font-bold" : "text-gray-600")}>{SIDES[id].label}</span>
              </div>
              {isActive ? <Check className="w-4 h-4 text-gray-900" /> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function SetPopover({
  open,
  onClose,
  sets,
  currentSet,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  sets: SetDef[];
  currentSet: SetId | null;
  onPick: (next: SetId | null) => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[95]"
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className="absolute top-12 right-0 w-60 bg-white rounded-xl shadow-xl border border-gray-100 z-[100] py-2 animate-in fade-in zoom-in-95 duration-100">
        <div className="px-4 py-2 text-[11px] font-black text-gray-400 uppercase tracking-widest">Set</div>

        {/* All */}
        <button
          type="button"
          onClick={() => onPick(null)}
          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm font-medium flex justify-between items-center"
        >
          <span className={cn(!currentSet ? "text-gray-900 font-bold" : "text-gray-600")}>All</span>
          {!currentSet ? <Check className="w-4 h-4 text-gray-900" /> : null}
        </button>

        <div className="h-px bg-gray-100 my-1 mx-2" />

        {/* Sets list (keep short later: recent/pinned) */}
        {sets.map((s) => {
          const isActive = currentSet === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm font-medium flex justify-between items-center"
            >
              <span className={cn(isActive ? "text-gray-900 font-bold" : "text-gray-600")}>{s.label}</span>
              {isActive ? <Check className="w-4 h-4 text-gray-900" /> : null}
            </button>
          );
        })}

        <div className="h-px bg-gray-100 my-1 mx-2" />

        <Link
          href="/siddes-sets"
          onClick={() => onClose()}
          className="block w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Manage sets
        </Link>
      </div>
    </>
  );
}

/**
 * DesktopTopBar (MVP Utility Header)
 * - Left: Side chip → small popover.
 * - Right: Set popover only on /siddes-feed (Set) — private sides only.
 * - Else: page title.
 * - No search/bell/inbox shortcuts/user menu (MVP: rail owns navigation).
 */
export function DesktopTopBar() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { side, setSide } = useSide();
  const theme = SIDE_THEMES[side];

  const isNow = pathname === "/siddes-feed" || pathname.startsWith("/siddes-feed/");
  const pageTitle = useMemo(() => titleFor(pathname), [pathname]);

  const [sideOpen, setSideOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);

  const [sets, setSets] = useState<SetDef[]>([]);
  const [activeSet, setActiveSet] = useState<SetId | null>(null);

  // Cmd/Ctrl+K opens Search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = String((e as any).key || "").toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        router.push("/siddes-search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Close popovers on Escape
  useEffect(() => {
    if (!sideOpen && !setOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSideOpen(false);
        setSetOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sideOpen, setOpen]);

  // Load sets (private sides)
  useEffect(() => {
    let cancelled = false;

    if (side === "public") {
      setSets([]);
      setActiveSet(null);
      return;
    }

    const last = getStoredLastSetForSide(side);
    setActiveSet(last || null);

    getSetsProvider()
      .list({ side })
      .then((list) => {
        if (cancelled) return;
        const filtered = Array.isArray(list) ? list.filter((s) => s.side === side) : [];
        setSets(filtered);

        // sd_770: If localStorage had a stale setId for this Side, clear it.
        try {
          if (last && !filtered.some((x) => x.id === last)) {
            setActiveSet(null);
            setStoredLastSetForSide(side, null);
            emitAudienceChanged({ side, setId: null, topic: null, source: "DesktopTopBar" });
          }
        } catch {}
      })
      .catch(() => {
        if (cancelled) return;
        setSets([]);
      });

    return () => {
      cancelled = true;
    };
  }, [side]);

  // Follow global scope changes
  useEffect(() => {
    return subscribeAudienceChanged((evt) => {
      if (!evt || evt.side !== side) return;
      if (side === "public") return;
      setActiveSet((evt.setId as any) || null);
    });
  }, [side]);

  const activeSetLabel = useMemo(() => {
    if (side === "public") return "All";
    if (!activeSet) return SIDES[side].label;
    const s = sets.find((x) => x.id === activeSet);
    return s ? s.label : SIDES[side].label;
  }, [side, activeSet, sets]);

  const canPickSet = isNow && side !== "public";

  return (
    <div className="sticky top-0 z-[90] bg-white/95 backdrop-blur border-b border-gray-50 relative">
      <div className={cn("absolute left-0 right-0 bottom-0 h-[3px]", theme.primaryBg)} aria-hidden />
      <div className="h-16">
        <div className="mx-auto w-full max-w-[760px] px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Side chip */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setSetOpen(false);
              setSideOpen((v) => !v);
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-full",
              "bg-gray-50 hover:bg-gray-100 transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
            )}
            aria-label="Change Side"
            title="Change Side"
          >
            <span className={cn("w-2.5 h-2.5 rounded-full", theme.primaryBg)} aria-hidden />
            <span className="text-sm font-black tracking-tight text-gray-900">{SIDES[side].label}</span>
            <ChevronDown size={14} className={cn("text-gray-400 transition-transform", sideOpen ? "rotate-180" : "")} aria-hidden />
          </button>

          <SidePopover
            open={sideOpen}
            onClose={() => setSideOpen(false)}
            currentSide={side}
            onPick={(next) => {
              setSideOpen(false);
              setSetOpen(false);

              // Run after confirm (Public confirm flow) so scope matches the actual Side.
              setSide(next, {
                afterConfirm: () => {
                  if (next === "public") {
                    setActiveSet(null);
                    emitAudienceChanged({ side: next, setId: null, topic: null, source: "DesktopTopBar" });
                    return;
                  }

                  const last = getStoredLastSetForSide(next);
                  setActiveSet(last || null);
                  emitAudienceChanged({ side: next, setId: last || null, topic: null, source: "DesktopTopBar" });
                },
              });
            }}
          />
        </div>

        {/* Right: Set on Now, else title */}
        <div className="relative flex items-center justify-end min-w-0 gap-2">
          {/* Search entrypoint */}
          <Link
            href="/siddes-search"
            className="p-2 rounded-full hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
            aria-label="Search"
            title="Search"
          >
            <SearchIcon size={18} className="text-gray-500" aria-hidden />
          </Link>

          {false ? (
            canPickSet ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSideOpen(false);
                    setSetOpen((v) => !v);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full",
                    "bg-gray-50 hover:bg-gray-100 transition-colors",
                    "text-sm font-extrabold text-gray-700",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
                  )}
                  aria-label="Choose group"
                  title="Choose group"
                >
                  <span className="truncate max-w-[220px]">{activeSetLabel}</span>
                  <ChevronDown size={14} className={cn("text-gray-400 transition-transform", setOpen ? "rotate-180" : "")} aria-hidden />
                </button>

                <SetPopover
                  open={setOpen}
                  onClose={() => setSetOpen(false)}
                  sets={sets}
                  currentSet={activeSet}
                  onPick={(next) => {
                    setSetOpen(false);
                    setActiveSet(next);
                    setStoredLastSetForSide(side, next);
                    emitAudienceChanged({ side, setId: next, topic: null, source: "DesktopTopBar" });
                  }}
                />
              </>
            ) : (
              <div className="px-3 py-2 rounded-full bg-gray-50 text-sm font-extrabold text-gray-400 select-none">All</div>
            )
          ) : pageTitle ? (
            <div className="text-sm font-semibold text-gray-700 pr-1 select-none">{pageTitle}</div>
          ) : (
            <div />
          )}
        </div>
        </div>
      </div>
    </div>
  );
}