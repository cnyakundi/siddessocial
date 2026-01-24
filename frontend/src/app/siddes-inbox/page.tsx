"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Search, UserPlus, X } from "lucide-react";

import { useSide } from "@/src/components/SideProvider";
import { saveReturnScroll, useReturnScrollRestore } from "@/src/hooks/returnScroll";
import { toast } from "@/src/lib/toastBus";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { InboxThreadItem } from "@/src/lib/inboxProvider";
import { getInboxProvider } from "@/src/lib/inboxProvider";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function hashSeed(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

function avatarOverlayStyle(seed?: string | null): React.CSSProperties | null {
  const raw = String(seed || "").trim();
  if (!raw) return null;

  const h = hashSeed(raw);
  const variant = h % 6;
  const ox = h % 7;
  const oy = (h >>> 3) % 7;
  const pos = `${ox}px ${oy}px`;

  if (variant === 0) {
    return {
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0, rgba(255,255,255,0.45) 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
      backgroundPosition: pos,
    };
  }
  if (variant === 1) {
    return {
      backgroundImage:
        "repeating-linear-gradient(-45deg, rgba(0,0,0,0.08) 0, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 4px)",
      backgroundPosition: pos,
    };
  }
  if (variant === 2) {
    return {
      backgroundImage: "radial-gradient(rgba(0,0,0,0.10) 1px, transparent 1px)",
      backgroundSize: "6px 6px",
      backgroundPosition: pos,
    };
  }
  if (variant === 3) {
    return {
      backgroundImage:
        "linear-gradient(rgba(0,0,0,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.10) 1px, transparent 1px)",
      backgroundSize: "7px 7px",
      backgroundPosition: pos,
    };
  }
  if (variant === 4) {
    return {
      backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)",
    };
  }

  return {
    backgroundImage:
      "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%), radial-gradient(circle at 70% 70%, rgba(0,0,0,0.08), rgba(0,0,0,0) 60%)",
  };
}

function AvatarBubble({
  initials,
  sideId,
  seed,
}: {
  initials: string;
  sideId?: SideId;
  seed?: string | null;
}) {
  const v = (initials || "??").slice(0, 2).toUpperCase();
  const theme = sideId ? SIDE_THEMES[sideId] : null;
  const overlayStyle = avatarOverlayStyle(seed);

  return (
    <div
      className={cn(
        "relative w-11 h-11 rounded-full border flex items-center justify-center text-[11px] font-black select-none overflow-hidden shrink-0",
        theme ? theme.lightBg : "bg-gray-200",
        theme ? theme.border : "border-gray-200",
        theme ? theme.text : "text-gray-800"
      )}
      aria-label="Avatar"
      title={sideId ? `Locked Side: ${SIDES[sideId].label}` : "Avatar"}
    >
      {overlayStyle ? (
        <div aria-hidden className="absolute inset-0 opacity-50 pointer-events-none" style={overlayStyle} />
      ) : null}
      <span className="relative z-10">{v}</span>
    </div>
  );
}

export default function SiddesInboxPage() {
  return (
    <Suspense fallback={<div className="px-4 py-4 text-xs text-gray-500">Loading inbox…</div>}>
      <SiddesInboxPageInner />
    </Suspense>
  );
}

/**
 * sd_543b: Inbox MVP default
 * - Default: calm list of threads locked to the current Side (no filters/search/pins).
 * - Power tools behind ?advanced=1 (search + invites link).
 * - Header chrome is owned by AppTopBar/DesktopTopBar skeleton.
 */
function SiddesInboxPageInner() {
  const { side } = useSide();
  const theme = SIDE_THEMES[side];
  const router = useRouter();
  const params = useSearchParams();

  // sd_543b: unlock power tools only when explicitly requested
  const advanced = params.get("advanced") === "1";

  // sd_464d1: restore scroll when returning from thread detail
  useReturnScrollRestore();

  const provider = useMemo(() => getInboxProvider(), []);
  const PAGE_SIZE = 25;

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [threads, setThreads] = useState<InboxThreadItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!advanced) setQuery("");
  }, [advanced, side]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setHasMore(false);
    setNextCursor(null);

    provider
      .listThreads({ side, limit: PAGE_SIZE })
      .then((page) => {
        if (!alive) return;
        const items = (page?.items || []) as InboxThreadItem[];
        setThreads(items);
        setHasMore(Boolean(page?.hasMore));
        setNextCursor(page?.nextCursor ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setThreads([]);
        setHasMore(false);
        setNextCursor(null);
        setError("Failed to load inbox.");
        toast?.error?.("Inbox failed to load");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, side]);

  const filtered = useMemo(() => {
    if (!advanced) return threads;
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const title = (t.title || "").toLowerCase();
      const last = (t.last || "").toLowerCase();
      return title.includes(q) || last.includes(q);
    });
  }, [threads, query, advanced]);

  const loadMore = async () => {
    if (provider.name !== "backend_stub") return;
    if (!hasMore || !nextCursor) return;
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const page = await provider.listThreads({ side, limit: PAGE_SIZE, cursor: nextCursor });
      const items = (page?.items || []) as InboxThreadItem[];

      setThreads((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...items.filter((t) => !seen.has(t.id))];
      });

      setHasMore(Boolean(page?.hasMore));
      setNextCursor(page?.nextCursor ?? null);
    } catch {
      toast?.error?.("Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 px-1">
        <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <Lock size={12} className="text-gray-400" />
          Conversations locked to <span className={cn(theme.text, "font-semibold")}>{SIDES[side].label}</span>
        </p>
      </div>

      {advanced ? (
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search threads"
              className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                aria-label="Clear search"
                title="Clear"
              >
                <X size={16} className="text-gray-500" />
              </button>
            ) : null}
          </div>

          <Link
            href="/siddes-invites"
            className="inline-flex items-center gap-2 text-xs font-extrabold px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            aria-label="Open invites"
            title="Invites"
          >
            <UserPlus size={16} className="text-gray-500" />
            <span className="hidden sm:inline">Invites</span>
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
          <div className="font-bold">Inbox error</div>
          <div className="text-xs mt-1">{error}</div>
        </div>
      ) : null}

      {loading ? <div className="text-xs text-gray-500 mb-2">Loading inbox…</div> : null}

      <div role="listbox" aria-label="Inbox threads" className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {filtered.map((t) => {
          const initials = String((t.title || "??").slice(0, 2));
          return (
            <Link
              key={t.id}
              href={"/siddes-inbox/" + t.id}
              role="option"
              onClick={(e) => {
                e.preventDefault();
                saveReturnScroll();
                router.push("/siddes-inbox/" + t.id);
              }}
              className="block px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 active:bg-gray-50/60 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <AvatarBubble initials={initials} sideId={side} seed={String(t.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-black text-gray-900">{t.title}</span>
                    <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">{t.time}</span>
                  </div>
                  <div className="text-[13px] font-medium text-gray-600 truncate">{t.last}</div>
                </div>
                {t.unread > 0 ? <span className="w-2 h-2 rounded-full bg-red-500" aria-label="Unread" /> : null}
              </div>
            </Link>
          );
        })}

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-sm text-gray-500">No conversations in this Side yet.</div>
        ) : null}
      </div>

      {provider.name === "backend_stub" && hasMore ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className={cn(
              "px-4 py-2 rounded-full border text-sm font-bold",
              loadingMore
                ? "bg-gray-100 text-gray-500 border-gray-200"
                : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
            )}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
