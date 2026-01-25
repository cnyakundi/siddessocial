"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageCircle } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { useReturnScrollRestore } from "@/src/hooks/returnScroll";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { PostCard } from "@/src/components/PostCard";
import { PublicTuneSheet } from "@/src/components/PublicTuneSheet";
import { SetPickerSheet } from "@/src/components/SetPickerSheet";
import { ImportSetSheet } from "@/src/components/ImportSetSheet";
import { FeedComposerRow } from "@/src/components/FeedComposerRow";

import type { SetDef, SetId } from "@/src/lib/sets";
import { DEFAULT_SETS } from "@/src/lib/sets";
import { getSetsProvider } from "@/src/lib/setsProvider";
import { getLastSeenId, setLastSeenId } from "@/src/lib/lastSeen";
import { fetchMe } from "@/src/lib/authMe";
import type { FeedItem } from "@/src/lib/feedProvider";
import { getFeedProvider } from "@/src/lib/feedProvider";
import { getSessionIdentity, touchSessionConfirmed, updateSessionFromMe } from "@/src/lib/sessionIdentity";
import { getCachedFeedPage, makeFeedCacheKey, setCachedFeedPage } from "@/src/lib/feedInstantCache";
import { FLAGS } from "@/src/lib/flags";
import type { PublicCalmUiState } from "@/src/lib/publicCalmUi";
import { EVT_PUBLIC_CALM_UI_CHANGED, loadPublicCalmUi, savePublicCalmUi } from "@/src/lib/publicCalmUi";
import type { PublicChannelId } from "@/src/lib/publicChannels";
import { PUBLIC_CHANNELS } from "@/src/lib/publicChannels";
import type { PublicSidingState } from "@/src/lib/publicSiding";
import { EVT_PUBLIC_SIDING_CHANGED, loadPublicSiding } from "@/src/lib/publicSiding";
import { toast } from "@/src/lib/toast";

import { enqueuePost } from "@/src/lib/offlineQueue";
import { isRestrictedError, isRestrictedPayload, restrictedMessage } from "@/src/lib/restricted";
import { FeedModuleCard } from "@/src/components/feedModules/FeedModuleCard";
import type { FeedModulePlanEntry } from "@/src/lib/feedModules";
import { EVT_FEED_MODULES_CHANGED, planFeedModules } from "@/src/lib/feedModules";
import {
  EVT_PUBLIC_TRUST_DIAL_CHANGED,
  loadPublicTrustMode,
  minTrustForMode,
  savePublicTrustMode,
  type PublicTrustMode,
} from "@/src/lib/publicTrustDial";
import { getStoredLastPublicTopic, getStoredLastSetForSide, setStoredLastPublicTopic, setStoredLastSetForSide, emitAudienceChanged, subscribeAudienceChanged } from "@/src/lib/audienceStore";

// sd_465c: reduce feed jank by memoizing PostCard (avoids rerenders on overlay/state toggles)
const MemoPostCard = React.memo(PostCard);

// Feed paging size (cursor-based)
const PAGE_LIMIT = 20;



function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function EmptyState({ side, onCreateSet, composeHref }: { side: SideId; onCreateSet?: () => void; composeHref?: string }) {
  // sd_201: actionable empty state (build the graph, ethically)
  const meta = SIDES[side];
  const theme = SIDE_THEMES[side];

  // sd_210_desktop_breathing
  return (
    <div className="mt-2 p-10 rounded-2xl text-center border border-dashed border-gray-200 bg-gray-50">
      <div className="flex justify-center mb-4">
        <span
          className={cn(
            "text-[10px] px-2 py-1 rounded-full border font-black uppercase tracking-widest",
            theme.lightBg,
            theme.text,
            theme.border
          )}
          title={meta.privacyHint}
        >
          {side === "public" ? `Public: ${meta.privacyHint}` : `Audience locked: ${meta.label}`}
        </span>
      </div>

      <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4", theme.lightBg, theme.text)}>
        <MessageCircle size={28} />
      </div>

      <p className="text-gray-800 text-sm font-semibold mb-1">No posts in {meta.label} yet.</p>
      <p className="text-gray-500 text-xs mb-6">Start a thread, or invite a few people so this Side comes alive.</p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
        <Link
          href={composeHref || `/siddes-compose?side=${side}`}
          className={cn("px-4 py-2 rounded-full text-sm font-extrabold text-white shadow-sm hover:opacity-95 transition", theme.primaryBg)}
        >
          New Post
        </Link>

        {side !== "public" ? (<button
            type="button"
            onClick={onCreateSet}
            className="px-4 py-2 rounded-full text-sm font-extrabold bg-white border border-gray-200 text-gray-800 shadow-sm hover:bg-gray-100 transition"
          >
            Create Set
          </button>) : null}
</div>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4 py-6 opacity-70" data-testid="new-since-divider">
      <div className="h-px bg-gray-300 flex-1" />
      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">New since last visit</span>
      <div className="h-px bg-gray-300 flex-1" />
    </div>
  );
}

export function SideFeed() {
  const { side } = useSide();
  const router = useRouter();
  const theme = SIDE_THEMES[side];

  // sd_573: restore scroll when returning from post detail.
  useReturnScrollRestore();

  // Audience filter (Sets for private sides; Topics for Public)
  const [activeSet, setActiveSet] = useState<SetId | null>(null);
  const [setPickerOpen, setSetPickerOpen] = useState(false);

  const [publicChannel, setPublicChannel] = useState<"all" | PublicChannelId>("all");
  const [publicTuneOpen, setPublicTuneOpen] = useState(false);
  const [trustMode, setTrustMode] = useState<PublicTrustMode>("standard");
  const [importOpen, setImportOpen] = useState(false);


  // Audience sync (TopBar <-> Feed <-> Compose)
  useEffect(() => {
    // Hydration-safe: restore last chosen scope for this Side.
    try {
      if (side === "public") {
        const raw = FLAGS.publicChannels ? getStoredLastPublicTopic() : null;
        const t = raw && PUBLIC_CHANNELS.some((c) => c.id === raw) ? (raw as PublicChannelId) : null;
        setPublicChannel(t || "all");
        setActiveSet(null);
      } else {
        const sid = getStoredLastSetForSide(side);
        setActiveSet(sid || null);
      }
    } catch {}
  }, [side]);

  useEffect(() => {
    // Keep feed scope synced with the app-wide audience bus (TopBar, BottomNav, etc.)
    const off = subscribeAudienceChanged((e) => {
      if (!e || e.side !== side) return;
      if (side === "public") {
        const t = e.topic;
        setPublicChannel(FLAGS.publicChannels && t ? (t as any) : "all");
      } else {
        setActiveSet((e.setId as any) || null);
      }
    });
    return () => {
      try { off(); } catch {}
    };
  }, [side]);

  const pickSet = useCallback(
    (next: SetId | null) => {
      setActiveSet(next);
      try { setStoredLastSetForSide(side, next); } catch {}
      try { emitAudienceChanged({ side, setId: next, topic: null, source: "SideFeed" }); } catch {}
    },
    [side]
  );

  const pickPublicChannel = useCallback((next: "all" | PublicChannelId) => {
    setPublicChannel(next);
    const topic = next === "all" ? null : next;
    try { setStoredLastPublicTopic(topic); } catch {}
    try { emitAudienceChanged({ side: "public", topic, setId: null, source: "SideFeed" }); } catch {}
  }, []);

  // sd_404: context-safe compose entry (inherit Side + audience)
  const composeHref = useMemo(() => {
    const base = `/siddes-compose?side=${encodeURIComponent(side)}`;
    if (side === "public") {
      const topic = FLAGS.publicChannels && publicChannel !== "all" ? publicChannel : null;
      return topic ? `${base}&topic=${encodeURIComponent(topic)}` : base;
    }
    return activeSet ? `${base}&set=${encodeURIComponent(activeSet)}` : base;
  }, [side, activeSet, publicChannel]);

  const submitQuick = useCallback(
    async (text: string) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return { ok: false, message: "Write something first." };

      const topic = side === "public" && FLAGS.publicChannels && publicChannel !== "all" ? publicChannel : null;
      const setId = side !== "public" ? (activeSet || null) : null;

      try {
        const res = await fetch("/api/post", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            side,
            text: trimmed,
            setId,
            publicChannel: topic,
            urgent: false,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          if (typeof isRestrictedPayload === "function" && isRestrictedPayload(res, data)) {
            return { ok: false, message: restrictedMessage(data) };
          }
          const msg = String(data?.error || data?.message || "Couldn’t post — try again.");
          return { ok: false, message: msg };
        }

        const post = data?.post;
        if (post?.id) {
          setRawPosts((prev) => {
            if (prev.some((p) => p?.id === post.id)) return prev;
            return [post, ...prev];
          });
        }

        return { ok: true };
      } catch {
        // Offline / network error — queue and tell the user (no pretend-send).
        if (typeof enqueuePost === "function") {
          enqueuePost(side, trimmed, { setId, publicChannel: topic });
        }
        if (typeof toast?.info === "function") {
          toast.info("Offline — queued. Will send when you’re back online.");
        }
        return { ok: true };
      }
    },
    [activeSet, publicChannel, side]
  );



  // Public Granular Siding state (hydration-safe: loaded after mount)
  const [publicSiding, setPublicSiding] = useState<PublicSidingState | null>(null);

  // Public Visual Calm (counts) state (hydration-safe: loaded after mount)
  const [publicCalm, setPublicCalm] = useState<PublicCalmUiState | null>(null);

  // Feed modules tick: bumped when a module is dismissed/undismissed
  const [modulesTick, setModulesTick] = useState(0);

  const setsProvider = useMemo(() => getSetsProvider(), []);
  const [sets, setSets] = useState<SetDef[]>(() => DEFAULT_SETS);

  const provider = useMemo(() => getFeedProvider(), []);
  const [rawPosts, setRawPosts] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreErr, setLoadMoreErr] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // sd_365: True list virtualization (window virtualizer)
  const listTopRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const [restricted, setRestricted] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (loadingMore || loadingInitial) return;
    if (!hasMore || !nextCursor) return;

    setLoadingMore(true);
    setLoadMoreErr(null);

    try {
      const topic = side === "public" && FLAGS.publicChannels && publicChannel !== "all" ? publicChannel : null;
      const page = await provider.listPage(side, {
        topic,
        set: side !== "public" ? (activeSet || null) : null,
        limit: PAGE_LIMIT,
        cursor: nextCursor,
      });

      const items = Array.isArray(page?.items) ? page.items : [];
      setRawPosts((prev) => [...prev, ...items]);
      setNextCursor(page?.nextCursor ?? null);
      setHasMore(Boolean(page?.hasMore));
    } catch (e) {
      if (isRestrictedError(e)) {
        setRestricted(true);
        setLoadErr(null);
        setLoadMoreErr(null);
      } else {
        const msg = e instanceof Error ? e.message : (typeof e === "string" ? e : "Couldn’t load more.");
        setLoadMoreErr(String(msg));
      }
    } finally {
      setLoadingMore(false);
    }
  }, [activeSet, hasMore, nextCursor, provider, publicChannel, side, loadingMore, loadingInitial]);


    // Reset side-scoped UI state when side changes.
  // Part 2: "instant feel" cache (stale-while-revalidate) scoped by viewer + auth-epoch + side.
  useEffect(() => {
    let mounted = true;

    (async () => {
      setRestricted(false);
      setLoadErr(null);
      setLoadMoreErr(null);
      setLoadingMore(false);
      setNextCursor(null);
      setHasMore(false);
      setRefreshing(false);

      const topic = side === "public" && FLAGS.publicChannels && publicChannel !== "all" ? publicChannel : null;
      const setId = side !== "public" ? (activeSet || null) : null;

      // Ensure we have a user-scoped identity for safe cache keys.
      let ident = getSessionIdentity();
      if ((!ident.viewerId || !ident.epoch || !ident.authed) && typeof fetchMe === "function") {
        try {
          const me = await fetchMe();
          updateSessionFromMe(me);
        } catch {
          // ignore
        }
        ident = getSessionIdentity();
      }

      if (!mounted) return;

      const viewerAtStart = ident.viewerId;
      const epochAtStart = ident.epoch;
      const canUseCache = !!viewerAtStart && !!epochAtStart && ident.authed;

      let usedCache = false;
      let cacheKey: string | null = null;

      if (canUseCache) {
        cacheKey = makeFeedCacheKey({
          epoch: String(epochAtStart),
          viewerId: String(viewerAtStart),
          side,
          topic,
          setId,
          cursor: null,
          limit: PAGE_LIMIT,
        });
        const cached = getCachedFeedPage(cacheKey);
        if (cached) {
          usedCache = true;
          setRawPosts(cached.items || []);
          setNextCursor(cached.nextCursor ?? null);
          setHasMore(Boolean(cached.hasMore));
          setLoadingInitial(false);
          setRefreshing(true);
        }
      }

      if (!usedCache) {
        setRawPosts([]);
        setLoadingInitial(true);
      }

      try {
        const page = await provider.listPage(side, { topic, set: setId, limit: PAGE_LIMIT, cursor: null });
        if (!mounted) return;

        setRawPosts(page.items || []);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setLoadingInitial(false);
        setRefreshing(false);

        // Successful authenticated fetch -> mark session as recently confirmed.
        touchSessionConfirmed();

        // Only store into the same identity that initiated this load.
        if (cacheKey && viewerAtStart && epochAtStart) {
          const identNow = getSessionIdentity();
          if (identNow.viewerId === viewerAtStart && identNow.epoch === epochAtStart && identNow.authed) {
            setCachedFeedPage(cacheKey, page);
          }
        }
      } catch (e: any) {
        if (!mounted) return;

        setRefreshing(false);

        if (isRestrictedError(e)) {
          // Fail closed: do not show cached content if the session is restricted.
          setRestricted(true);
          setLoadErr(null);
          setRawPosts([]);
          setNextCursor(null);
          setHasMore(false);
          setLoadingInitial(false);
          return;
        }

        const msg = String(e?.message || "Feed failed");
        if (usedCache) {
          // Soft fail: keep the cached view and tell the user gently.
          try {
            toast.info("Offline / flaky network — showing last known feed.");
          } catch {}
          setLoadErr(null);
          setLoadingInitial(false);
          return;
        }

        setLoadErr(msg);
        setRawPosts([]);
        setNextCursor(null);
        setHasMore(false);
        setLoadingInitial(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [side, provider, publicChannel, activeSet]);

  useEffect(() => {
    if (!hasMore || !nextCursor) return;
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            loadMore();
            break;
          }
        }
      },
      { rootMargin: "600px 0px" }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [side, hasMore, nextCursor, loadMore]);


  // Side-scoped Sets load (hydration-safe)
  useEffect(() => {
    let mounted = true;
    if (side === "public") {
      setSets([]);
      return;
    }
    setsProvider
      .list({ side })
      .then((items) => {
        if (!mounted) return;
        setSets(items);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, [side, setsProvider]);

  // Hydration-safe: only read localStorage after mount.
  useEffect(() => {
    if (!FLAGS.publicChannels) return;
    try {
      setPublicSiding(loadPublicSiding());
      const onChanged = () => setPublicSiding(loadPublicSiding());
      window.addEventListener(EVT_PUBLIC_SIDING_CHANGED, onChanged);
      return () => window.removeEventListener(EVT_PUBLIC_SIDING_CHANGED, onChanged);
    } catch {
      return;
    }
  }, []);

  // Hydration-safe: Trust Dial preference (localStorage) after mount.
  useEffect(() => {
    if (!FLAGS.publicTrustDial) return;
    try {
      setTrustMode(loadPublicTrustMode());
      const onChanged = () => setTrustMode(loadPublicTrustMode());
      window.addEventListener(EVT_PUBLIC_TRUST_DIAL_CHANGED, onChanged);
      return () => window.removeEventListener(EVT_PUBLIC_TRUST_DIAL_CHANGED, onChanged);
    } catch {
      return;
    }
  }, []);

  // Hydration-safe: Visual Calm preference (localStorage) after mount.
  useEffect(() => {
    if (!FLAGS.publicCalmUi) return;
    try {
      setPublicCalm(loadPublicCalmUi());
      const onChanged = () => setPublicCalm(loadPublicCalmUi());
      window.addEventListener(EVT_PUBLIC_CALM_UI_CHANGED, onChanged);
      return () => window.removeEventListener(EVT_PUBLIC_CALM_UI_CHANGED, onChanged);
    } catch {
      return;
    }
  }, []);

  // Feed modules: listen for dismissed/undismissed updates (hydration-safe)
  useEffect(() => {
    if (!FLAGS.feedModules) return;
    const onChanged = () => setModulesTick((x) => x + 1);
    window.addEventListener(EVT_FEED_MODULES_CHANGED, onChanged);
    return () => window.removeEventListener(EVT_FEED_MODULES_CHANGED, onChanged);
  }, []);

  const applyTrustMode = (m: PublicTrustMode) => {
    setTrustMode(m);
    savePublicTrustMode(m);
  };

  const countsShown = publicCalm?.showCounts ?? false;

  const toggleCounts = () => {
    const next = { showCounts: !countsShown };
    setPublicCalm(next);
    savePublicCalmUi(next);
  };

  const calmHideCounts = side === "public" && FLAGS.publicCalmUi && !countsShown;

  const posts = useMemo(() => {
    let out = rawPosts;

    // Enrich posts with Set metadata (label/color) so ContextStamp shows real Set names.
    // Presentational only: access control remains server-side.
    if (side !== "public" && Array.isArray(sets) && sets.length) {
      const byId = new Map(sets.map((s) => [s.id, s] as const));
      out = out.map((p: any) => {
        const sid = String(p?.setId || "").trim();
        if (!sid) return p;
        if (p?.setLabel && p?.setColor) return p;
        const meta = byId.get(sid);
        if (!meta) return p;
        return { ...p, setLabel: p.setLabel || meta.label, setColor: p.setColor || meta.color };
      });
    }

    // Side-private Set filter
    if (side !== "public" && activeSet) {
      out = out.filter((p: any) => p.setId === activeSet);
    }

    // Public: Trust Dial (under-the-hood trust bands)
    if (side === "public" && FLAGS.publicTrustDial) {
      const min = minTrustForMode(trustMode);
      out = out.filter((p: any) => {
        const lvl = typeof p.trustLevel === "number" ? p.trustLevel : 1;
        return lvl >= min;
      });
    }

    // Public: Granular Siding (per-author topic prefs)
    if (side === "public" && FLAGS.publicChannels && publicSiding) {
      out = out.filter((p: any) => {
        const key = (p.handle || "").toString();
        if (!key) return true;

        const rec = (publicSiding as any).byKey?.[key];
        if (!rec) return true;

        const ch = ((p.publicChannel || "general") as any).toString();
        const allowed = Array.isArray(rec.topics) ? rec.topics : [];
        return allowed.includes(ch);
      });
    }

    // Public: global topic filter
    if (side === "public" && FLAGS.publicChannels && publicChannel !== "all") {
      out = out.filter((p: any) => (p.publicChannel || "general") === publicChannel);
    }

    return out;
  }, [rawPosts, sets, side, activeSet, publicChannel, publicSiding, trustMode]);

  const modulePlan = useMemo(() => {
    // modulesTick is a deliberate recompute trigger when modules are dismissed/undismissed
    void modulesTick;
    if (!FLAGS.feedModules) return [] as FeedModulePlanEntry[];
    const activeSetDef = activeSet ? sets.find((s) => s.id === activeSet) || null : null;
    return planFeedModules({
      side,
      sets,
      activeSet: activeSetDef,
      publicChannel,
      postCount: posts.length,
    });
  }, [side, sets, activeSet, publicChannel, posts.length, modulesTick]);

  const modulesAfter = useMemo(() => {
    const m = new Map<number, any[]>();
    for (const e of modulePlan) {
      const arr = m.get(e.after) || [];
      arr.push(e.module);
      m.set(e.after, arr);
    }
    return m;
  }, [modulePlan]);

  const lastSeenId = useMemo(() => getLastSeenId(side), [side]);
  const dividerIndex = useMemo(() => {
    if (!lastSeenId) return posts.length ? 0 : -1;
    const idx = posts.findIndex((p) => p.id === lastSeenId);
    if (idx === -1) return posts.length ? 0 : -1;
    return idx;
  }, [posts, lastSeenId]);


  // sd_365: Flatten feed output into "rows" so we can window-virtualize.
  type FeedRow =
    | { kind: "divider"; key: string }
    | { kind: "post"; key: string; post: FeedItem; postIndex: number }
    | { kind: "module"; key: string; module: any };

  const rows = useMemo(() => {
    const out: FeedRow[] = [];

    for (let i = 0; i < posts.length; i++) {
      if (dividerIndex === i) {
        out.push({ kind: "divider", key: `divider:${lastSeenId || "start"}` });
      }

      const p = posts[i] as any;
      out.push({ kind: "post", key: `post:${p.id}`, post: p as any, postIndex: i });

      if (FLAGS.feedModules) {
        const mods = modulesAfter.get(i) || [];
        for (const m of mods) {
          const mid = String((m as any)?.id || `${i}-${out.length}`);
          out.push({ kind: "module", key: `module:${mid}:after:${p.id}`, module: m });
        }
      }
    }

    return out;
  }, [posts, dividerIndex, lastSeenId, modulesAfter]);

  // sd_365: Window virtualizer needs the list's distance from the top of the document.
  useEffect(() => {
    const el = listTopRef.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const margin = window.scrollY + rect.top;
      setScrollMargin(Number.isFinite(margin) ? margin : 0);
    };

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [side, publicChannel, activeSet, posts.length]);

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 200,
    overscan: 8,
    scrollMargin,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  useEffect(() => {
    if (!rawPosts.length) return;
    const top = rawPosts[0];
    const t = window.setTimeout(() => setLastSeenId(side, top.id), 500);
    return () => window.clearTimeout(t);
  }, [side, rawPosts]);

  const addSetToState = (s: SetDef) => {
    setSets((prev) => [s, ...prev.filter((x) => x.id !== s.id)]);
  };

  const publicChannelLabel = useMemo(() => {
    if (publicChannel === "all") return "All Topics";
    const c = PUBLIC_CHANNELS.find((x) => x.id === publicChannel);
    return c ? c.label : "Topic";
  }, [publicChannel]);

  const activeSetLabel = useMemo(() => {
    if (!activeSet) return `All ${SIDES[side].label}`;
    const s = sets.find((x) => x.id === activeSet);
    return s ? s.label : "Set";
  }, [activeSet, sets, side]);

  const showPublicTune = side === "public";

  return (
    <div className="w-full min-h-full bg-white">
            {/* Feed header: audience pill */}
      <div className="hidden">
        <div className="flex items-center gap-3 min-w-0">
          {showPublicTune ? (
            <button
              type="button"
              onClick={() => setPublicTuneOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-extrabold text-gray-700 transition-colors min-w-0"
              aria-label="Tune public feed"
            >
              <span className="truncate">{publicChannelLabel}</span>
<ChevronDown size={14} className="text-gray-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSetPickerOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-extrabold text-gray-700 transition-colors min-w-0"
              aria-label="Select set"
            >
              <span className="truncate">{activeSetLabel}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

{/* Set picker (private sides) */}
      {side !== "public" ? (
        <SetPickerSheet
          open={setPickerOpen}
          onClose={() => setSetPickerOpen(false)}
          sets={(sets || []).filter((s) => s.side === side)}
          activeSet={activeSet}
          onPick={pickSet}
          onNewSet={() => {
            if (process.env.NODE_ENV !== "production") setImportOpen(true);
            else router.push("/siddes-sets?create=1");
          }}
          title="Choose Set"
          allLabel={`All ${SIDES[side].label}`}
        />
      ) : null}

      {/* Public tune */}
      <PublicTuneSheet
        open={publicTuneOpen}
        onClose={() => setPublicTuneOpen(false)}
        showTopics={side === "public" && FLAGS.publicChannels}
        showTrust={side === "public" && FLAGS.publicTrustDial}
        showCounts={side === "public" && FLAGS.publicCalmUi}
        publicChannel={publicChannel}
        onPublicChannel={pickPublicChannel}
        trustMode={trustMode}
        onTrustMode={applyTrustMode}
        countsShown={countsShown}
        onToggleCounts={toggleCounts}
/>


{/* Composer (in-feed) */}
      <FeedComposerRow
        side={side}
        prompt={
          side === "public"
            ? (FLAGS.publicChannels && publicChannel !== "all"
                ? `Share in ${publicChannelLabel}…`
                : "Share with everyone…")
            : (activeSet ? `Post to ${activeSetLabel}…` : `Post to ${SIDES[side].label}…`)
        }
        subtitle={side === "public" ? SIDES[side].privacyHint : (activeSet ? `In ${activeSetLabel}` : undefined)}
        onSubmit={submitQuick}
        onOpen={() => {
          try {
            window.sessionStorage.setItem("sd.compose.opened", "1");
          } catch {}
          const href = composeHref;
          try {
            (router).prefetch?.(href);
          } catch {}
          router.push(href);
        }}
      />

{/* Feed content */}
      <div className="pt-2 px-4 lg:px-0">
        {refreshing && !restricted && !loadErr ? (
          <div className="mb-2 flex items-center gap-2 text-[11px] text-gray-400" data-testid="feed-refreshing">
            <span className="inline-block h-2 w-2 rounded-full bg-gray-300 animate-pulse" aria-hidden="true" />
            <span>Refreshing…</span>
          </div>
        ) : null}
        {restricted ? (
          <div className="p-6 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 space-y-2" data-testid="feed-restricted">
            <div className="text-sm font-extrabold">This feed is restricted.</div>
            <div className="text-xs text-amber-800">{restrictedMessage(null)}</div>
            <div className="flex gap-2 flex-wrap pt-2">
              <Link
                href="/login"
                className="px-3 py-2 rounded-full bg-gray-900 text-white text-xs font-extrabold"
              >
                Go to Login
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-2 rounded-full bg-white border border-amber-200 text-amber-900 text-xs font-extrabold"
              >
                Retry
              </button>
            </div>
          </div>
        ) : loadErr ? (
          <div className="p-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 space-y-2" data-testid="feed-error">
            <div className="text-sm font-extrabold">Could not load the feed.</div>
            <div className="text-xs text-rose-800">{loadErr}</div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-2 rounded-full bg-gray-900 text-white text-xs font-extrabold"
              >
                Retry
              </button>
            </div>
          </div>
        ) : loadingInitial ? (
          <div className="space-y-3" data-testid="feed-loading">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                <div className="h-3 bg-gray-200 rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : rows.length ? (
          <div ref={listTopRef}>
            <div style={{ height: `${totalSize}px`, position: "relative" }}>
              {virtualRows.map((vr) => {
                const row = rows[vr.index];
                if (!row) return null;

                return (
                  <div
                    key={row.key}
                    data-index={vr.index}
                    ref={rowVirtualizer.measureElement}
                    className="px-4 lg:px-0"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vr.start - rowVirtualizer.options.scrollMargin}px)`,
                    }}
                  >
                    {row.kind === "divider" ? (
                      <Divider />
                    ) : row.kind === "post" ? (
                      <MemoPostCard post={row.post as any} side={side} calmHideCounts={calmHideCounts} variant="row" />
                    ) : (
                      <FeedModuleCard module={row.module} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {FLAGS.feedModules && modulePlan.length ? (
              <div className="space-y-3 mb-6">
                {modulePlan.map((e) => (
                  <FeedModuleCard key={e.module.id} module={e.module} />
                ))}
              </div>
            ) : null}
            <EmptyState side={side} composeHref={composeHref} onCreateSet={() => {
              if (process.env.NODE_ENV !== "production") setImportOpen(true);
              else router.push("/siddes-sets?create=1");
            }} />
          </>
        )}

        {!restricted && !loadErr && !loadingInitial ? (
          hasMore ? (
            <div className="mt-8 p-8 rounded-2xl text-center border border-dashed border-gray-200 bg-gray-50 space-y-3" data-testid="feed-load-more">
              <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
              {loadingMore ? (
                <p className="text-gray-500 font-medium">Loading more…</p>
              ) : (
                <button
                  type="button"
                  onClick={loadMore}
                  className="px-4 py-2 rounded-full bg-gray-900 text-white text-xs font-extrabold"
                >
                  Load more
                </button>
              )}
              {loadMoreErr ? <div className="text-xs text-rose-800">{loadMoreErr}</div> : null}
            </div>
          ) : posts.length ? (
            <div className="mt-8 p-8 rounded-2xl text-center border border-dashed border-gray-200 bg-gray-50">
              <p className="text-gray-500 font-medium">You're all caught up.</p>
            </div>
          ) : null
        ) : null}
      </div>

      {/* New Set flow */}
      <ImportSetSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onFinish={({ name, members }) => {
          void (async () => {
            const s = await setsProvider.create({ side, label: name, members });
            addSetToState(s);
            pickSet(s.id);
            toast.success(`Created Set \"${s.label}\" with ${s.members.length} members.`);
          })();
        }}
        onCreateSuggested={({ label, color, members, side: suggestedSide }) => {
          void (async () => {
            const s = await setsProvider.create({ side: (suggestedSide || side), label, members, color });
            addSetToState(s);
          })();
        }}
      />
    </div>
  );
}

