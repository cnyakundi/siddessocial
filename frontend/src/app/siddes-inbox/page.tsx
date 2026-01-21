"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Pin, Search, X, UserPlus } from "lucide-react";
import { InboxBanner } from "@/src/components/InboxBanner";
import { toast } from "@/src/lib/toastBus";
import { useSide } from "@/src/components/SideProvider";
import { saveReturnScroll, useReturnScrollRestore } from "@/src/hooks/returnScroll";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { InboxThreadItem } from "@/src/lib/inboxProvider";
import { getInboxProvider } from "@/src/lib/inboxProvider";
import { ensureThreadLockedSide, loadThread, loadThreadMeta } from "@/src/lib/threadStore";
import { loadUnreadMap } from "@/src/lib/inboxState";
import { loadPinnedSet, togglePinned } from "@/src/lib/inboxPins";
import { NotificationsView } from "@/src/components/NotificationsView";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function ageLabel(ts: number, nowMs: number): string {
  const diff = nowMs - ts;
  if (!Number.isFinite(diff) || diff < 0) return "now";
  if (diff < 60_000) return "now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const w = Math.floor(days / 7);
  return `${w}w`;
}

function formatAbsTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  try {
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return "";
  }
}

function parseRelativeToTs(label: string, nowMs: number): number | null {
  const m = String(label || "").trim().match(/^(\d+)([smhdw])$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2].toLowerCase();
  const ms =
    unit === "s"
      ? n * 1_000
      : unit === "m"
      ? n * 60_000
      : unit === "h"
      ? n * 3_600_000
      : unit === "d"
      ? n * 86_400_000
      : unit === "w"
      ? n * 604_800_000
      : 0;
  if (!ms) return null;
  return nowMs - ms;
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
        "relative w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-bold select-none overflow-hidden",
        theme ? theme.lightBg : "bg-gray-200",
        theme ? theme.border : "border-gray-200",
        theme ? theme.text : "text-gray-800"
      )}
      aria-label="Avatar"
      title={sideId ? `Locked Side: ${SIDES[sideId].label}` : "Avatar"}
    >
        {/* sd_466d: Activity (All) header (dead simple) */}
        <div className="px-4 pt-4 pb-2 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Activity (All)</h1>
            <div className="w-2 h-2 rounded-full bg-gray-200" aria-hidden="true" />
          </div>
        </div>

      {overlayStyle ? (
        <div aria-hidden className="absolute inset-0 opacity-50 pointer-events-none" style={overlayStyle} />
      ) : null}
      <span className="relative z-10">{v}</span>
    </div>
  );
}


function SidePill({ sideId }: { sideId: SideId }) {
  const meta = SIDES[sideId];
  const theme = SIDE_THEMES[sideId];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border select-none",
        theme.lightBg,
        theme.border
      )}
      aria-label={`Locked Side: ${meta.label}`}
      title={`Locked Side: ${meta.label}`}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", theme.primaryBg)} />
      <span className={cn(theme.text)}>{meta.label}</span>
      {meta.isPrivate ? <Lock size={11} className={cn("opacity-60", theme.text)} /> : null}
    </span>
  );
}

function ContextRiskBadge({ sideId }: { sideId: SideId }) {
  const isPrivate = SIDES[sideId]?.isPrivate;
  if (!isPrivate) return null;

  return (
    <span
      data-testid="context-risk"
      className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 select-none"
      aria-label="Context Risk"
      title="Private Side thread — double-check your context before replying."
    >
      Context Risk
    </span>
  );
}

type FilterId = "all" | "this" | "mismatch" | "unread";

function FilterChipsRow({
  active,
  onChange,
  counts,
  activeTheme,
}: {
  active: FilterId;
  onChange: (v: FilterId) => void;
  counts: { all: number; this: number; mismatch: number; unread: number };
  activeTheme: { lightBg: string; border: string; text: string };
}) {
  const base = "text-xs font-bold px-3 py-1 rounded-full border transition-colors";
  const inactive = "bg-white text-gray-700 border-gray-200 hover:bg-gray-50";
  const activeCls = cn(activeTheme.lightBg, activeTheme.border, activeTheme.text);

  const Chip = ({ id, label, count }: { id: FilterId; label: string; count: number }) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      aria-pressed={active === id}
      data-testid={`chip-${id}`}
      className={cn(base, active === id ? activeCls : inactive)}
      title={label}
    >
      {label}
      <span className={cn("ml-2 text-[11px] opacity-70")}>{count}</span>
    </button>
  );

  return (
    <div data-testid="inbox-filter-chips" className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
      <Chip id="all" label="All" count={counts.all} />
      <Chip id="this" label="This Side" count={counts.this} />
      <Chip id="mismatch" label="Mismatched" count={counts.mismatch} />
      <Chip id="unread" label="Unread" count={counts.unread} />
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

function SiddesInboxPageInner() {
  const { side, setSide } = useSide();
  const theme = SIDE_THEMES[side];
  const router = useRouter();
  const params = useSearchParams();

  // sd_464d1: restore scroll when returning from thread detail
  useReturnScrollRestore();

  type InboxTab = "messages" | "alerts";
  const tabParam = params.get("tab");
  const tab: InboxTab = tabParam === "alerts" ? "alerts" : "messages";

  const setTab = (next: InboxTab) => {
    const sp = new URLSearchParams(params.toString());
    if (next === "alerts") sp.set("tab", "alerts");
    else sp.delete("tab");
    const qs = sp.toString();
    router.replace(qs ? `/siddes-inbox?${qs}` : "/siddes-inbox");
  };

  const provider = useMemo(() => getInboxProvider(), []);
  const apiSide = (params.get("side") || undefined) as SideId | undefined;

  const PAGE_SIZE = 20;

  // Hydration-safe clock: server + initial client render both see nowMs=0.
  // We set the real time after mount.
  const [nowMs, setNowMs] = useState(0);

  const [threads, setThreads] = useState<InboxThreadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [lockedById, setLockedById] = useState<Record<string, SideId> | null>(null);
  const [unreadById, setUnreadById] = useState<Record<string, number> | null>(null);
  const [pinnedById, setPinnedById] = useState<Record<string, boolean> | null>(null);

  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    // Avoid hydration mismatches caused by Date.now() during render.
    // (Server render + client hydration must match byte-for-byte.)
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const recomputeLocalMaps = (list: InboxThreadItem[]) => {
    const locks: Record<string, SideId> = {};
    const fallbackUnread: Record<string, number> = {};

    for (const t of list) {
      const meta = ensureThreadLockedSide(t.id, t.lockedSide);
      locks[t.id] = meta.lockedSide;
      fallbackUnread[t.id] = t.unread ?? 0;
    }
    setLockedById(locks);

    const ids = list.map((t) => t.id);
    setUnreadById(loadUnreadMap(ids, fallbackUnread));

    const pinned = loadPinnedSet();
    const pins: Record<string, boolean> = {};
    for (const t of list) pins[t.id] = pinned.has(t.id);
    setPinnedById(pins);
  };

  useEffect(() => {
    let alive = true;

    setError(null);

    setLoading(true);
    setHasMore(false);
    setNextCursor(null);

    provider
      .listThreads({ side: apiSide, limit: PAGE_SIZE })
      .then((page) => {
        if (!alive) return;

        const items = (page?.items || []) as InboxThreadItem[];
        setThreads(items);
        setHasMore(Boolean(page?.hasMore));
        setNextCursor(page?.nextCursor ?? null);
        recomputeLocalMaps(items);
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
  }, [provider, apiSide]);

  const loadMore = async () => {
    if (provider.name !== "backend_stub") return;
    if (!hasMore || !nextCursor) return;
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const page = await provider.listThreads({ side: apiSide, limit: PAGE_SIZE, cursor: nextCursor });
      const items = (page?.items || []) as InboxThreadItem[];

      setThreads((prev) => {
        const seen = new Set(prev.map((t) => (t as any).id));
        const merged = [...prev, ...items.filter((t) => !seen.has((t as any).id))];
        recomputeLocalMaps(merged);
        return merged;
      });

      setHasMore(Boolean(page?.hasMore));
      setNextCursor(page?.nextCursor ?? null);
    } catch {
      setError("Failed to load more threads.");
      toast?.error?.("Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  // Local-only refresh on focus (unread + pins), no refetch
  useEffect(() => {
    const onFocus = () => {
      const list = threads;
      const ids = list.map((t) => t.id);
      const fallbackUnread: Record<string, number> = {};
      for (const t of list) fallbackUnread[t.id] = t.unread ?? 0;
      setUnreadById(loadUnreadMap(ids, fallbackUnread));

      const pinned = loadPinnedSet();
      const pins: Record<string, boolean> = {};
      for (const t of list) pins[t.id] = pinned.has(t.id);
      setPinnedById(pins);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [threads]);

  const rows = useMemo(() => {
    const seeded = threads.map((t) => {
      const lockedSide = lockedById?.[t.id] ?? t.lockedSide ?? "friends";
      const unread = unreadById?.[t.id] ?? t.unread ?? 0;
      const pinned = pinnedById?.[t.id] ?? false;
      const mismatch = lockedSide !== side;

      const msgs = loadThread(t.id);
      const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;

      const meta = loadThreadMeta(t.id);
      const nowReady = nowMs > 0;
      const fallbackTs = nowReady ? parseRelativeToTs(t.time, nowMs) ?? 0 : 0;

      const lastText = lastMsg?.text ?? t.last;
      const timeLabel = lastMsg ? (nowReady ? ageLabel(lastMsg.ts, nowMs) : t.time) : t.time;
      const sortTs = Math.max(meta?.updatedAt ?? 0, lastMsg?.ts ?? 0, fallbackTs);

      return { ...t, lockedSide, unread, pinned, mismatch, lastText, timeLabel, sortTs };
    });

    return seeded.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.sortTs - a.sortTs;
    });
  }, [threads, lockedById, unreadById, pinnedById, side, nowMs]);

  const counts = useMemo(() => {
    const mismatch = rows.filter((r) => r.mismatch).length;
    const same = rows.length - mismatch;
    const unread = rows.filter((r) => (r.unread ?? 0) > 0).length;
    return { all: rows.length, this: same, mismatch, unread };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = rows;

    // Keep explicit "all" branch for overlay gate checks + clarity.
    if (filter === "all") {
      base = rows;
    } else if (filter === "this") {
      base = base.filter((r) => !r.mismatch);
    } else if (filter === "mismatch") {
      base = base.filter((r) => r.mismatch);
    } else if (filter === "unread") {
      base = base.filter((r) => (r.unread ?? 0) > 0);
    }

    if (q) {
      base = base.filter((r) => {
        const title = (r.title ?? "").toLowerCase();
        const last = (r.mismatch ? "" : (r.lastText ?? "")).toLowerCase();
        return title.includes(q) || last.includes(q);
      });
    }

    return base;
  }, [rows, filter, query]);

  useEffect(() => {
    if (filteredRows.length === 0) {
      setActiveIdx(0);
      return;
    }
    setActiveIdx((i) => Math.max(0, Math.min(i, filteredRows.length - 1)));
  }, [filteredRows.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || "").toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (target ? (target as any).isContentEditable : false);

      if (isTyping || tag === "button" || tag === "a") return;
      if (filteredRows.length === 0) return;

      const key = (e.key || "").toLowerCase();
      if (key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filteredRows.length - 1));
        return;
      }
      if (key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        const t = filteredRows[activeIdx];
        if (!t) return;
        e.preventDefault();
        const locked = (t.lockedSide as SideId) ?? side;
        if (locked !== side) setSide(locked);
        saveReturnScroll();
        router.push(`/siddes-inbox/${t.id}`);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredRows, activeIdx, router, side, setSide]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-4">
        <div className="mb-3" data-testid="inbox-tabs">
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              data-testid="inbox-tab-messages"
              onClick={() => setTab("messages")}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold",
                tab === "messages" ? cn(theme.primaryBg, "text-white") : "text-gray-600 hover:bg-gray-50"
              )}
            >
              Messages
            </button>
            <button
              type="button"
              data-testid="inbox-tab-alerts"
              onClick={() => setTab("alerts")}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold",
                tab === "alerts" ? cn(theme.primaryBg, "text-white") : "text-gray-600 hover:bg-gray-50"
              )}
            >
              Alerts
            </button>
          </div>
        </div>

        {tab === "alerts" ? (
          <NotificationsView embedded />
        ) : (
          <>

                <div className="flex items-center justify-between mb-4">
          <div className={cn("md:hidden text-xs font-bold px-3 py-1 rounded-full border", theme.lightBg, theme.border, theme.text)}>
            {SIDES[side].label} Inbox
          </div>

          <Link
            href="/siddes-invites"
            data-testid="inbox-invites"
            className="inline-flex items-center gap-2 text-xs font-extrabold px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            aria-label="Open invites"
            title="Invites"
          >
            <UserPlus size={16} className="text-gray-500" />
            <span>Invites</span>
          </Link>
        </div>

        {error ? (
          <InboxBanner tone="danger" title="Inbox error">
            {error}
          </InboxBanner>
        ) : null}

        <FilterChipsRow active={filter} onChange={setFilter} counts={counts} activeTheme={theme} />

        <div className="mt-2 mb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads"
              aria-label="Search threads"
              data-testid="inbox-search"
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

          <div className="mt-1 text-[11px] text-gray-400 hidden md:block">
            Tip: press <span className="font-bold">J</span>/<span className="font-bold">K</span> to move,{" "}
            <span className="font-bold">Enter</span> to open.
          </div>
        </div>

        {loading ? <div className="text-xs text-gray-500 mb-2">Loading inbox…</div> : null}

        <div role="listbox" aria-label="Inbox threads" className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {filteredRows.map((t, idx) => {
            const lockedSide = t.lockedSide as SideId;

            return (
              <Link
                key={t.id}
                href={`/siddes-inbox/${t.id}`}
                data-testid={`thread-row-${t.id}`}
                role="option"
                aria-selected={idx === activeIdx}
                onClick={(e) => {
                  saveReturnScroll();
                  if (t.mismatch) {
                    e.preventDefault();
                    setSide(lockedSide);
                    saveReturnScroll();
                    router.push(`/siddes-inbox/${t.id}`);
                  }
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  "block px-4 py-4 border-b border-gray-100 hover:bg-gray-50 outline-none",
                  idx === activeIdx ? "bg-gray-50 ring-2 ring-gray-900/5" : ""
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-900 flex items-center gap-2 min-w-0">
                    <AvatarBubble initials={String((t as any).participant?.initials || (t.title ?? "").slice(0, 2))} sideId={lockedSide} seed={String((t as any).participant?.avatarSeed || t.id || "")} />
                    {t.unread > 0 ? <span className="w-2 h-2 rounded-full bg-red-500" aria-label="Unread" /> : null}
                    <span className="truncate">{t.title}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      data-testid={`pin-${t.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const next = togglePinned(t.id);
                        setPinnedById((prev) => ({ ...(prev ?? {}), [t.id]: next }));
                      }}
                      className={cn("p-1 rounded hover:bg-gray-100 transition", t.pinned ? "bg-gray-100" : "")}
                      aria-label={t.pinned ? "Unpin thread" : "Pin thread"}
                      title={t.pinned ? "Unpin" : "Pin"}
                    >
                      <Pin size={16} className={cn(t.pinned ? "text-gray-900" : "text-gray-400")} />
                    </button>

                    <SidePill sideId={lockedSide} />
                    <span className="hidden md:inline-flex"><ContextRiskBadge sideId={lockedSide} /></span>
                    <div
                      className="text-xs text-gray-400"
                      title={formatAbsTime(Number((t as any).updatedAt || 0))}
                    >
                      {t.timeLabel}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1">
                  {t.mismatch ? (
                    <div className="text-sm text-gray-400 italic truncate pr-4">
                      Message hidden — enter {SIDES[lockedSide].label} to view
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 truncate pr-4">{t.lastText}</div>
                  )}
                  {t.unread > 0 ? (
                    <div className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{t.unread}</div>
                  ) : null}
                </div>

                {t.mismatch ? (
                  <div className="mt-1 text-[11px] text-gray-400">
                    Locked to <span className="font-bold">{SIDES[lockedSide].label}</span> — you’re currently in{" "}
                    <span className="font-bold">{SIDES[side].label}</span>
                  </div>
                ) : null}
              </Link>
            );
          })}

          {filteredRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500">
              {query ? <>No threads match &ldquo;{query}&rdquo;.</> : <>No threads in this filter.</>}
            </div>
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
                loadingMore ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
              )}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}

        <p className="text-xs text-gray-400 mt-4">
          Local-only inbox: unread + pins + last-message sorting persist on this device.
        </p>
          </>
        )}
      </div>
    </div>
  );
}
