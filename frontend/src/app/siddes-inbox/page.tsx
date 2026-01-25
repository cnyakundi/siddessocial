"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Search, UserPlus, X, Pin } from "lucide-react";

import { useSide } from "@/src/components/SideProvider";
import { saveReturnScroll, useReturnScrollRestore } from "@/src/hooks/returnScroll";
import { toast } from "@/src/lib/toastBus";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { InboxThreadItem } from "@/src/lib/inboxProvider";
import { getInboxProvider } from "@/src/lib/inboxProvider";
import { loadPinnedSet, togglePinned } from "@/src/lib/inboxPins";
import { ensureThreadLockedSide, loadThread, loadThreadMeta } from "@/src/lib/threadStore";
import { InboxBanner } from "@/src/components/InboxBanner";
import { isRestrictedError, restrictedMessage } from "@/src/lib/restricted";
import { InboxStubDebugPanel } from "@/src/components/InboxStubDebugPanel";
import { useInboxStubViewer } from "@/src/lib/useInboxStubViewer";
import { loadUnreadMap } from "@/src/lib/inboxState";
type InboxFilter = "all" | "this" | "mismatch" | "unread";

// sd_573: sort threads by most recent activity (server updatedAt + local threadStore meta)
function sortTs(t: InboxThreadItem): number {
  const anyT: any = t as any;
  const serverTs =
    (typeof anyT.updatedAt === "number" ? anyT.updatedAt : 0) ||
    (typeof anyT.updatedAtMs === "number" ? anyT.updatedAtMs : 0) ||
    (typeof anyT.lastTs === "number" ? anyT.lastTs : 0) ||
    (typeof anyT.timeTs === "number" ? anyT.timeTs : 0) ||
    (typeof anyT.updatedAt === "string" ? Date.parse(anyT.updatedAt) : 0) ||
    0;

  // Avoid hydration mismatch: only read localStorage on the client.
  const localTs = typeof window === "undefined" ? 0 : (loadThreadMeta(t.id)?.updatedAt || 0);

  return Math.max(serverTs, localTs);
}


function formatAbsTime(ts: number): string {
  const n = Number(ts || 0);
  if (!n || !Number.isFinite(n)) return "";
  try {
    const d = new Date(n);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

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

function SidePill({ side }: { side: SideId }) {
  const t = SIDE_THEMES[side];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-extrabold",
        t.lightBg,
        t.border,
        t.text
      )}
      title={SIDES[side].privacyHint}
      aria-label={"Locked Side: " + SIDES[side].label}
    >
      <span className={cn("w-2 h-2 rounded-full", t.primaryBg)} aria-hidden="true" />
      <span className="whitespace-nowrap">{SIDES[side].label}</span>
    </span>
  );
}

function ContextRiskBadge({ isPrivate }: { isPrivate: boolean }) {
  if (!isPrivate) return null;
  return (
    <span
      data-testid="context-risk"
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-full border text-[11px] font-extrabold",
        "bg-amber-50",
        "border-amber-200",
        "text-amber-700"
      )}
      title="Context Risk"
      aria-label="Context Risk"
    >
      Context Risk
    </span>
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
  const debug = params.get("debug") === "1";
  // sd_464d1: restore scroll when returning from thread detail
  useReturnScrollRestore();

  const provider = useMemo(() => getInboxProvider(), []);
  const [viewerInput, setViewerInput] = useInboxStubViewer();
  const viewer = (viewerInput || "").trim() || undefined;
  const showContextRisk = true;

  const PAGE_SIZE = 25;

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);

  const [threads, setThreads] = useState<InboxThreadItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const [filter, setFilter] = useState<InboxFilter>("this");


  useEffect(() => {
    if (!advanced) setQuery("");
  }, [advanced, side]);

  
  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setRestricted(false);
    setHasMore(false);
    setNextCursor(null);

    provider
      .listThreads({ viewer, side: side, limit: PAGE_SIZE, signal: ac.signal })
      .then((page) => {
        if (!alive) return;

        if (page?.restricted) {
          setThreads([]);
          setHasMore(false);
          setNextCursor(null);
          setRestricted(true);
          return;
        }


        const pins = loadPinnedSet();
        const items = (page?.items || []).map((t: any) => ({ ...t, pinned: pins.has(t.id) }));
        setThreads(items as any);
        setHasMore(Boolean(page?.hasMore));
        setNextCursor(page?.nextCursor ?? null);
      })
      .catch((e) => {
        if (!alive) return;
        setThreads([]);
        setHasMore(false);
        setNextCursor(null);

        if (isRestrictedError(e)) {
          setRestricted(true);
          setError(null);
          return;
        }

        setError("Failed to load inbox.");
        toast?.error?.("Inbox failed to load");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
      try { ac.abort(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, side, viewer]);

  const unreadMap = useMemo(() => {
    const ids = threads.map((t) => String((t as any)?.id || ""));
    const fallback: Record<string, number> = {};
    for (const t of threads as any[]) {
      const id = String((t as any)?.id || "");
      if (!id) continue;
      const u0 = Number((t as any)?.unread ?? 0);
      fallback[id] = Number.isFinite(u0) && u0 > 0 ? Math.floor(u0) : 0;
    }
    return loadUnreadMap(ids, fallback);
  }, [threads]);

  const counts = useMemo(() => {
    const unread = Object.values(unreadMap).reduce((acc, n) => acc + (Number(n) > 0 ? 1 : 0), 0);
    return { unread };
  }, [unreadMap]);
const filtered = useMemo(() => {
    let items = threads;

    const lockedSideOf = (t: any) => (t?.lockedSide || t?.side || side);

    if (filter === "this") {
      items = items.filter((t) => lockedSideOf(t) === side);
    } else if (filter === "mismatch") {
      items = items.filter((t) => lockedSideOf(t) !== side);
    } else if (filter === "unread") {
            items = items.filter((t) => Number((unreadMap as any)[String((t as any).id)] ?? (t as any)?.unread ?? 0) > 0);
}

    if (advanced) {
      const q = query.trim().toLowerCase();
      if (q) {
        items = items.filter((t) => {
          const title = String(t?.title || "").toLowerCase();
          const last = String(t?.last || "").toLowerCase();
          return title.includes(q) || last.includes(q);
        });
      }
    }

    // sd_574: pinned-first sort (local-only), then most-recent activity
    items = [...items].sort((a: any, b: any) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return sortTs(b) - sortTs(a);
    });

    return items;
  }, [threads, query, advanced, filter, side, unreadMap]);

  useEffect(() => {
    setActiveIndex((prev) => {
      const max = Math.max(0, filtered.length - 1);
      return Math.min(max, Math.max(0, prev));
    });
  }, [filtered.length]);

  // Keyboard nav: j/k to move selection, Enter to open.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key;

      // Ignore when typing in an input/textarea or contenteditable
      const target = e.target as HTMLElement | null;
      const tag = target && (target as any).tagName ? String((target as any).tagName).toLowerCase() : "";
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        (target && (target as any).isContentEditable);

      if (isTyping) return;

      if (key === "j") {
        e.preventDefault();
        setActiveIndex((prev) => {
          const max = Math.max(0, filtered.length - 1);
          return Math.min(max, prev + 1);
        });
        return;
      }

      if (key === "k") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key === "Enter") {
        const t = filtered[activeIndex];
        if (t && (t as any).id) {
          e.preventDefault();
          saveReturnScroll();
          router.push("/siddes-inbox/" + (t as any).id);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, filtered, router]);

  const loadMore = async () => {
    if (restricted) return;
    if (provider.name !== "backend_stub") return;
    if (!hasMore || !nextCursor) return;
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const page = await provider.listThreads({ viewer, side: side, limit: PAGE_SIZE, cursor: nextCursor });
      const pins = loadPinnedSet();
      const items = (page?.items || []).map((t: any) => ({ ...t, pinned: pins.has(t.id) })) as any as InboxThreadItem[];

      setThreads((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...items.filter((t) => !seen.has(t.id))];
      });

      setHasMore(Boolean(page?.hasMore));
      setNextCursor(page?.nextCursor ?? null);
    } catch (e) {
      if (isRestrictedError(e)) {
        setRestricted(true);
        setError(null);
        return;
      }
      toast?.error?.("Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="p-4">
      {debug ? <InboxStubDebugPanel viewer={viewerInput} onViewer={setViewerInput} /> : null}
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
              placeholder="Search threads"
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
            className={cn("inline-flex items-center gap-2 text-xs font-extrabold px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50")}
            aria-label="Open invites"
            title="Invites"
          >
            <UserPlus size={16} className="text-gray-500" />
            <span className="hidden sm:inline">Invites</span>
          </Link>
        </div>
      ) : null}

      {restricted ? (
        <InboxBanner tone="warn" title="Restricted inbox">
          <div className="space-y-2">
            <div>{restrictedMessage(null)}</div>
            <div className="flex gap-2 flex-wrap">
              <Link href="/login" className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100">
                Sign in
              </Link>
            </div>
          </div>
        </InboxBanner>
      ) : null}


      {error ? (
        <div className="mb-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
          <div className="font-bold">Inbox error</div>
          <div className="text-xs mt-1">{error}</div>
        </div>
      ) : null}

      {loading ? <div className="text-xs text-gray-500 mb-2">Loading inbox…</div> : null}

      
      <div data-testid="inbox-filter-chips" className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="chip-all"
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1 rounded-full border text-[11px] font-extrabold",
            filter === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
          )}
          aria-pressed={filter === "all"}
        >
          All
        </button>

        <button
          type="button"
          data-testid="chip-this"
          onClick={() => setFilter("this")}
          className={cn(
            "px-3 py-1 rounded-full border text-[11px] font-extrabold",
            filter === "this" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
          )}
          aria-pressed={filter === "this"}
        >
          This Side
        </button>

        <button
          type="button"
          data-testid="chip-mismatch"
          onClick={() => setFilter("mismatch")}
          className={cn(
            "px-3 py-1 rounded-full border text-[11px] font-extrabold",
            filter === "mismatch" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
          )}
          aria-pressed={filter === "mismatch"}
        >
          Mismatched
        </button>

        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={cn(
            "px-3 py-1 rounded-full border text-[11px] font-extrabold",
            filter === "unread" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
          )}
          aria-pressed={filter === "unread"}
        >
          <span>Unread</span>
          <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-black">
            {counts.unread}
          </span>
        </button>
      </div>
<div role="listbox" aria-label="Inbox threads" className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {filtered.map((t, i) => {
    const meta = ensureThreadLockedSide(t.id, t.lockedSide);
    const lockedSide = meta.lockedSide;
    const isPrivate = lockedSide !== "public";

          // sd_573: local preview + recency (immediate UI updates after sending)
          const localMsgs = loadThread(t.id);
          const lastLocal = localMsgs && localMsgs.length ? localMsgs[localMsgs.length - 1] : null;
          const lastText = String((lastLocal as any)?.text || t.last || "");


          const participant = (t as any)?.participant as any;
          const initials = String(participant?.initials || (t.title || "??")).slice(0, 2);
          const sideId = ((t as any)?.lockedSide as SideId) || side;
          const seed = String(participant?.avatarSeed || t.id || "").trim() || null;
          const ts = sortTs(t);
          return (
            <Link
              key={t.id}
              href={"/siddes-inbox/" + t.id}
              role="option"
              aria-selected={i === activeIndex}
              onClick={(e) => {
                e.preventDefault();
                saveReturnScroll();
                router.push("/siddes-inbox/" + t.id);
              }}
              className="block px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 active:bg-gray-50/60 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <AvatarBubble initials={initials} sideId={(t.lockedSide || side) as any} seed={String((t as any)?.participant?.avatarSeed || t.id || "").trim() || String(t.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-black text-gray-900">{t.title}</span>
                    <span className="text-[11px] font-bold text-gray-400 flex-shrink-0" title={formatAbsTime(ts)}>{t.time}</span>
                    {showContextRisk ? <ContextRiskBadge isPrivate={isPrivate} /> : null}
                  </div>
                  <div className="text-[13px] font-medium text-gray-600 truncate">{lastText}</div>
                  <div className="mt-2 flex items-center gap-2"><SidePill side={lockedSide} /><ContextRiskBadge isPrivate={isPrivate} /></div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const nowPinned = togglePinned(String(t.id));
                    setThreads((prev) =>
                      prev.map((x: any) => (x.id === t.id ? { ...x, pinned: nowPinned } : x))
                    );
                  }}
                  className={cn(
                    "p-2 rounded-full hover:bg-gray-100 active:scale-95 transition-transform",
                    t.pinned ? "text-gray-900" : "text-gray-300"
                  )}
                  aria-label={t.pinned ? "Unpin thread" : "Pin thread"}
                >
                  <Pin size={16} />
                </button>
                {(Number((unreadMap as any)[String(t.id)] ?? (t as any).unread ?? 0) > 0) ? <span className="w-2 h-2 rounded-full bg-red-500" aria-label="Unread" /> : null}
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
            data-testid="inbox-load-more"

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

// counts.unread


// sd_609_inbox_page_abort
