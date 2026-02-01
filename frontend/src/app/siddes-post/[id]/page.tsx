"use client";

/**
 * sd_973: reply JSON helper (safe single-consume)
 * - Some flows read reply JSON more than once; Response.json() can only be consumed once.
 * - Cache the promise per Response so subsequent reads reuse the same payload.
 */
const __sd_replyJsonOnceCache_v2 = new WeakMap<Response, Promise<any>>();

async function __sd_read_reply_json_once_v2(res: Response) {
  try {
    if (!res) return null;
    const cached = __sd_replyJsonOnceCache_v2.get(res);
    if (cached) return await cached;
    const p = res.json().catch(() => null);
    __sd_replyJsonOnceCache_v2.set(res, p);
    return await p;
  } catch {
    return null;
  }
}


export const dynamic = "force-dynamic";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import type { FeedPost } from "@/src/lib/feedTypes";
import { PostCard } from "@/src/components/PostCard";
import { FLAGS } from "@/src/lib/flags";
import type { PublicCalmUiState } from "@/src/lib/publicCalmUi";
import { EVT_PUBLIC_CALM_UI_CHANGED, loadPublicCalmUi } from "@/src/lib/publicCalmUi";
import { ContentColumn } from "@/src/components/ContentColumn";
import { toast } from "@/src/lib/toast";
import { getStubViewerCookie, isStubMe } from "@/src/lib/stubViewerClient";
import { fetchMe } from "@/src/lib/authMe";
import { getSessionIdentity, touchSessionConfirmed, updateSessionFromMe } from "@/src/lib/sessionIdentity";
import { getCachedPost, makePostCacheKey, setCachedPost } from "@/src/lib/postInstantCache";
import { getCirclesProvider } from "@/src/lib/circlesProvider";
import { PostHero } from "@/src/components/thread/PostHero";
import { ThreadTree } from "@/src/components/thread/ThreadTree";
import {
  enqueueReply,
  countQueuedRepliesForPost,
  listQueuedRepliesForPost,
  queueChangedEventName,
  removeQueuedItem,
} from "@/src/lib/offlineQueue";

type Found = { post: FeedPost; side: SideId } | null;

type StoredReply = { id: string; postId: string; authorId: string; author?: string; handle?: string; text: string; createdAt: number; clientKey?: string | null; parentId?: string | null; depth?: number };

type ReplySendError = { kind: "validation" | "restricted" | "network" | "server" | "unknown"; message: string };

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function shouldOpenReply(search: URLSearchParams | null): boolean {
  return !!search && search.get("reply") === "1";
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;

    return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
      Queued reply{n === 1 ? "" : "ies"}: {n}
    </span>
  );
}

function ReplyAvatar({ label, tone }: { label: string; tone: "neutral" | "queued" }) {
  const base =
    tone === "queued"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  const letter = (label || "R").replace(/^@/, "").trim().slice(0, 1).toUpperCase() || "R";

  return (
    <div
      className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black shrink-0 ${base}`}
      aria-hidden="true"
      title={label}
    >
      {letter}
    </div>
  );
}

function whoLabel(authorId: string): string {
  const viewer = getStubViewerCookie();
  const mine = viewer ? authorId === viewer : isStubMe(authorId);
  return mine ? "You" : authorId || "Unknown";
}


function toProfileHref(handleOrId?: string | null): string | null {
  const raw = String(handleOrId || "").trim();
  if (!raw) return null;
  const u = raw.replace(/^@/, "").split(/\s+/)[0]?.trim() || "";
  return u ? `/u/${encodeURIComponent(u)}` : null;
}


function QueuedReplies({ postId }: { postId: string }) {
  const [replies, setReplies] = useState(() => listQueuedRepliesForPost(postId));

  useEffect(() => {
    const refresh = () => setReplies(listQueuedRepliesForPost(postId));
    refresh();
    const evt = queueChangedEventName();
    window.addEventListener(evt, refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener(evt, refresh);
      window.removeEventListener("online", refresh);
    };
  }, [postId]);

  if (!replies.length) return null;

  return (
    <div className="mt-3" data-testid="queued-replies">
      <div className="text-[10px] font-extrabold text-amber-700 uppercase tracking-widest mb-2">Queued</div>
      <div className="space-y-2">
        {replies.map((r) => (
          <div key={r.id} className="p-3 rounded-2xl border border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <ReplyAvatar label="You" tone="queued" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className="font-extrabold text-amber-900">You</span>
                  <span className="tabular-nums text-amber-800">{new Date(r.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="text-sm text-gray-900 leading-relaxed">{r.text}</div>
                <div className="mt-1 text-[10px] font-bold text-amber-700">Queued (offline)</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentReplies({ postId, onReplyTo, onCountChange }: { postId: string; onReplyTo?: (parentId: string, label: string) => void; onCountChange?: (n: number) => void }) {
  const [replies, setReplies] = useState<StoredReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/post/${encodeURIComponent(postId)}/replies`, { cache: "no-store" });
      if (!res.ok) {
        setReplies([]);
        try {
          onCountChange?.(0);
        } catch {}
        return;
      }
      const data = await res.json();
      const rs = ((data.replies || []) as StoredReply[]);
      setReplies(rs);
      try {
        onCountChange?.(rs.length);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [postId, onCountChange]);

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((d) => {
        if (!mounted) return;
        const v = (d && (d as any).viewerId) ? String((d as any).viewerId) : (getStubViewerCookie() || null);
        setViewerId(v);
      })
      .catch(() => setViewerId(getStubViewerCookie() || null));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => refresh();
    const evt = `sd.post.replies.changed:${postId}`;
    const qevt = queueChangedEventName();
    window.addEventListener(evt, on);
    window.addEventListener(qevt, on);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener(evt, on);
      window.removeEventListener(qevt, on);
      window.removeEventListener("online", on);
    };
  }, [postId, refresh]);

  return (
    <div className="mt-6" data-testid="sent-replies">
      <div className="flex items-baseline gap-2 mb-3">
        <div className="text-[11px] font-black text-gray-900">{replies.length === 1 ? "1 Reply" : `${replies.length} Replies`}</div>
      </div>

            {loading && !replies.length ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : replies.length ? (
        <div className="space-y-2">
          <ThreadTree replies={replies} viewerId={viewerId} onReplyTo={onReplyTo} />
        </div>
      ) : (
        <div className="text-sm text-gray-400">No replies yet.</div>
      )}
    </div>
  );
}

function SideMismatchBanner({
  active,
  target,
  onEnter,
}: {
  active: SideId;
  target: SideId;
  onEnter: () => void;
}) {
  if (active === target) return null;
  const t = SIDES[target];
  const a = SIDES[active];
  const theme = SIDE_THEMES[target];

  return (
    <div className={cn("mb-4 rounded-2xl border p-4", theme.border, theme.lightBg)} data-testid="side-mismatch-banner">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-gray-900">
            This post is in <span className={cn("font-black", theme.text)}>{t.label}</span>.
          </div>
          <div className="text-xs text-gray-600 mt-1">
            You're currently in <span className="font-bold">{a.label}</span>. To reply, enter {t.label}.
          </div>
        </div>
        <button
          type="button"
          onClick={onEnter}
          className={cn(
            "px-3 py-2 rounded-full text-sm font-extrabold text-white hover:opacity-90",
            theme.primaryBg
          )}
        >
          Enter {t.label}
        </button>
      </div>
    </div>
  );
}

function PostDetailInner() {
  const params = useParams();
  const sp = useSearchParams();
  const router = useRouter();

  // sd_760: In PWA/deep-links, history may point outside the app.
  // Prefer a saved internal return path (from returnScroll) when available.
  const [savedReturn, setSavedReturn] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const p = window.sessionStorage.getItem("sd.return.path");
      if (!p) return;
      if (
        p.startsWith("/siddes-feed") ||
        p.startsWith("/siddes-circles") ||
        p.startsWith("/siddes-inbox") ||
        p.startsWith("/siddes-notifications") ||
        p.startsWith("/siddes-search") ||
        p.startsWith("/search") ||
        p.startsWith("/u/") ||
        p.startsWith("/siddes-profile")
      ) {
        setSavedReturn(p);
      }
    } catch {}
  }, []);

  // If this post was opened from Search, provide a clean back-link.
  const backToSearchHref = (() => {
    const from = sp?.get("from") || "";
    if (from !== "search") return null;
    const back = sp?.get("back") || "";
    if (!back) return "/siddes-search";
    try {
      const qs = decodeURIComponent(back);
      return qs ? "/siddes-search?" + qs : "/siddes-search";
    } catch {
      return "/siddes-search";
    }
  })();
  const backHref = backToSearchHref || savedReturn || "/siddes-feed";
  const backLabel = (() => {
    if (backToSearchHref) return "Search";
    const r = String(savedReturn || "");
    if (r.startsWith("/siddes-inbox")) return r.includes("tab=alerts") ? "Alerts" : "Inbox";
    if (r.startsWith("/siddes-notifications")) return "Alerts";
    if (r.startsWith("/siddes-circles")) return "Sets";
    if (r.startsWith("/siddes-search") || r.startsWith("/search")) return "Search";
    if (r.startsWith("/u/")) return "Profile";
    if (r.startsWith("/siddes-profile")) return "Me";
    return "Feed";
  })();


  const id = (params?.id as string) || "";

  const { side: activeSide, setSide, setSideLock, clearSideLock } = useSide();

  const [found, setFound] = useState<Found>(null);
  const [loading, setLoading] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [replyTo, setReplyTo] = useState<{ parentId: string | null; label: string } | null>(null);
  const replyInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<ReplySendError | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [sentReplyCount, setSentReplyCount] = useState<number | null>(null);


/* sd_957_reply_json_helper: Response body can only be consumed once — cache it safely. */
const __sd_reply_json_cache = new WeakMap<Response, any>();
async function __sd_read_reply_json_once_v2(res: Response): Promise<any> {
  if (__sd_reply_json_cache.has(res)) return __sd_reply_json_cache.get(res);
  let j: any = null;
  try {
    const txt = await res.text();
    j = txt ? JSON.parse(txt) : null;
  } catch {
    j = null;
  }
  __sd_reply_json_cache.set(res, j);
  return j;
}

const sendReplyNow = useCallback(async () => {
  if (!found) return;

  const postSide = found.side;
  if (activeSide !== postSide) {
    toast.error(`Enter ${SIDES[postSide].label} to reply.`);
    return;
  }

  const t = String(replyText || "").trim();
  const parentId = replyTo?.parentId ? String(replyTo.parentId) : null;

  if (!t) {
    setReplyError({ kind: "validation", message: "Write something first." });
    return;
  }

  if (t.length > 2000) {
    setReplyError({ kind: "validation", message: "Too long. Max 2000 characters." });
    return;
  }

  if (replyBusy) return;
  setReplyBusy(true);
  setReplyError(null);

  const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;

  // Offline: queue and keep UI truthful.
  if (!onlineNow) {
    const queued = enqueueReply(found.side, found.post.id, t, parentId);
    setReplyText("");
    setReplyTo(null);
    setReplyBusy(false);
    toast.undo("Reply queued (offline).", () => removeQueuedItem(queued.id));
    return;
  }

  try {
    const res = await fetch(`/api/post/${encodeURIComponent(found.post.id)}/reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: t, parentId, client_key: `reply_${Date.now().toString(36)}` , parent_id: parentId || null}),
    });
    // sd_959_reply_send_parse_once: response body can only be consumed once.
    let data: any = null;
    try {
      const txt = await res.text();
      data = txt ? JSON.parse(txt) : null;
    } catch {
      data = null;
    }
    const j = data as any;

    if (res.ok) {
      if (!j || (j as any).ok !== false) {
        setReplyText("");
        setReplyTo(null);
        setReplyBusy(false);
        toast.success("Reply sent.");
        try {
          window.dispatchEvent(new Event(`sd.post.replies.changed:${found.post.id}`));
        } catch {
          // ignore
        }
        return;
      }
    }

    const code = j && typeof (j as any).error === "string" ? String((j as any).error) : "request_failed";


    if (res.status === 400) {
      if (code === "too_long" && j && typeof j.max === "number") {
        setReplyError({ kind: "validation", message: `Too long. Max ${j.max} characters.` });
      } else if (code === "empty_text") {
        setReplyError({ kind: "validation", message: "Write something first." });
      } else {
        setReplyError({ kind: "validation", message: "Couldn’t send — check your reply." });
      }
      setReplyBusy(false);
      return;
    }

    if (res.status === 401) {
      setReplyError({ kind: "restricted", message: "Login required to reply." });
      setReplyBusy(false);
      return;
    }

    if (res.status === 403) {
      const hint = j && typeof j.error === "string" ? String(j.error) : "restricted";
      if (hint === "public_trust_low" && j && typeof j.min_trust === "number") {
        setReplyError({ kind: "restricted", message: `Public replies require Trust L${j.min_trust}+.` });
      } else if (hint === "rate_limited" && j && typeof j.retry_after_ms === "number") {
        const sec = Math.max(1, Math.round(Number(j.retry_after_ms) / 1000));
        setReplyError({ kind: "restricted", message: `Slow down — try again in ${sec}s.` });
      } else {
        setReplyError({ kind: "restricted", message: "Restricted: you can’t reply here." });
      }
      setReplyBusy(false);
      return;
    }

    if (res.status >= 500) {
      setReplyError({ kind: "server", message: "Server error — reply not sent. Try again." });
      setReplyBusy(false);
      return;
    }

    setReplyError({ kind: "unknown", message: "Couldn’t send reply — try again." });
    setReplyBusy(false);
    return;
  } catch {
    setReplyError({ kind: "network", message: "Network error — reply not sent. Try again." });
    setReplyBusy(false);
    return;
  }
}
// sd_954b_parent_id_in_post_detail
, [found, activeSide, replyText, replyTo, replyBusy]);



  // Public Visual Calm (counts) — hydration-safe: read localStorage after mount.
  const [publicCalm, setPublicCalm] = useState<PublicCalmUiState | null>(null);

  useEffect(() => {
    if (id) setQueuedCount(countQueuedRepliesForPost(id));
    const refresh = () => setQueuedCount(countQueuedRepliesForPost(id));
    const evt = queueChangedEventName();
    window.addEventListener(evt, refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener(evt, refresh);
      window.removeEventListener("online", refresh);
    };
  }, [id]);

useEffect(() => {
  if (!shouldOpenReply(sp)) return;
  // Focus the sticky composer when opened via ?reply=1
  window.setTimeout(() => {
    try {
      replyInputRef.current?.focus();
    } catch {
      // ignore
    }
  }, 50);
}, [sp]);

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

  useEffect(() => {
    let mounted = true;
    if (!id) return;

    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;

    async function load() {
      setLoading(true);
      let cacheKey: string | null = null;
      let usedCache = false;

      try {
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

        // Only show cached thread if the session was confirmed recently (reduces stale-access risk).
        const confirmedAt = typeof ident.confirmedAt === "number" ? ident.confirmedAt : null;
        const confirmedFresh = !!confirmedAt && Date.now() - confirmedAt < 120_000;
        const canUseCache = confirmedFresh && ident.authed && !!ident.viewerId && !!ident.epoch;

        if (canUseCache) {
          cacheKey = makePostCacheKey({
            epoch: String(ident.epoch),
            viewerId: String(ident.viewerId),
            postId: String(id),
          });
          const cached = getCachedPost(cacheKey);
          if (cached) {
            usedCache = true;
            setFound(cached);
          }
        }

        const res = await fetch(`/api/post/${encodeURIComponent(id)}`, { cache: "no-store", signal: (ctrl as any)?.signal });
        if (!mounted) return;

        if (!res.ok) {
          // Fail closed if access changed.
          setFound(null);
          return;
        }

        const data = await res.json().catch(() => null);
        if (!mounted) return;

        if (data?.ok) {
          const next = { post: data.post, side: data.side } as any;
          setFound(next);
          touchSessionConfirmed();
          if (cacheKey) {
            try { setCachedPost(cacheKey, next); } catch {}
          }
        } else {
          setFound(null);
        }
      } catch {
        if (!mounted) return;
        if (usedCache) {
          try {
            toast.info("Offline / flaky network — showing last opened thread.");
          } catch {}
          return;
        }
        setFound(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      try { (ctrl as any)?.abort?.(); } catch {}
    };
  }, [id]);
// Enrich post with Set metadata for private sides so ContextStamp shows the real Circle name/color.
  useEffect(() => {
    let mounted = true;
    if (!found) return;

    const postId = String((found.post as any)?.id || found.post.id || "");
    const setId = String((found.post as any)?.setId || "").trim();
    const side = found.side;

    if (!postId || !setId) return;
    if (side === "public") return;

    const hasLabel = typeof (found.post as any)?.setLabel === "string" && String((found.post as any).setLabel || "").trim().length > 0;
    const hasColor = typeof (found.post as any)?.setColor === "string" && String((found.post as any).setColor || "").trim().length > 0;
    if (hasLabel && hasColor) return;

    const setsProvider = getCirclesProvider();
    setsProvider
      .get(setId)
      .then((s) => {
        if (!mounted) return;
        if (!s) return;
        setFound((prev) => {
          if (!prev) return prev;
          if (String((prev.post as any)?.id || prev.post.id || "") !== postId) return prev;
          return {
            ...prev,
            post: {
              ...prev.post,
              setLabel: (prev.post as any).setLabel || s.label,
              setColor: (prev.post as any).setColor || s.color,
            },
          };
        });
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [found]);


  // sd_524: SideLock effect must not be conditional (hooks must run in a stable order).
  const postSideForLock = found?.side;

  useEffect(() => {
    if (!postSideForLock) return;
    setSideLock({ side: postSideForLock, reason: "thread" });
    return () => clearSideLock();
  }, [postSideForLock, setSideLock, clearSideLock]);

  if (loading && !found) {
    return (
      <div className="py-6">
        <ContentColumn>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 animate-pulse" aria-label="Loading post">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-100" />
              <div className="flex-1 min-w-0">
                <div className="h-4 bg-gray-100 rounded w-40" />
                <div className="mt-2 h-4 bg-gray-100 rounded w-56" />
                <div className="mt-5 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-11/12" />
                  <div className="h-4 bg-gray-100 rounded w-8/12" />
                </div>
                <div className="mt-6 flex gap-6">
                  <div className="h-9 bg-gray-100 rounded w-24" />
                  <div className="h-9 bg-gray-100 rounded w-24" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-4 animate-pulse" aria-label="Loading reply">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-32" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-10/12" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="sr-only">Loading…</div>
        </ContentColumn>
      </div>
    );
  }

  if (!found) {
    return (
      <div className="py-10">
        <ContentColumn>
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="text-lg font-bold text-gray-900">Post not found</div>
            <p className="text-sm text-gray-500 mt-2">
              It may have been deleted, or you might not have access in your current Side.
            </p>
            <Link href={backHref} className="inline-block mt-4 text-sm font-extrabold text-gray-700 hover:underline">
              ← Back to {backLabel}
            </Link>
          </div>
        </ContentColumn>
      </div>
    );
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const postSide = found.side;
  const mismatch = activeSide !== postSide;
  const postMeta = SIDES[postSide];
  const theme = SIDE_THEMES[postSide];

  const enterSide = () => {
    setSide(postSide, { afterConfirm: () => toast.success(`Entered ${postMeta.label}.`) });
  };

  
  // sd_955_replying_to_jump: jump to a reply node and briefly highlight it
  const jumpToReply = (targetId: string | null | undefined) => {
    const id = String(targetId || "").trim();
    if (!id) return;
    const el = typeof document !== "undefined" ? document.getElementById(`reply-${id}`) : null;
    if (!el) return;

    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}

    try {
      (el as any).animate?.(
        [
          { backgroundColor: "rgba(59, 130, 246, 0.14)", boxShadow: "0 0 0 0 rgba(59,130,246,0.0)" },
          { backgroundColor: "rgba(59, 130, 246, 0.06)", boxShadow: "0 0 0 10px rgba(59,130,246,0.0)" },
          { backgroundColor: "transparent", boxShadow: "0 0 0 0 rgba(59,130,246,0.0)" },
        ],
        { duration: 900, easing: "ease-out" }
      );
    } catch {}
  };

return (
    <div className="relative sd-min-h-shell pb-[260px]" data-testid="thread-shell">
      <div aria-hidden className={cn("absolute inset-0 opacity-30 pointer-events-none", theme.lightBg)} />
      <ContentColumn className="relative z-10 pt-4">
        {/* sd_951_v5_post_hero_force_replace: PostHero inserted (fallback) */}
        <PostHero post={(found as any)?.post ?? (found as any)} side={(found as any)?.side ?? "public"} theme={theme} onReply={() => { try { replyInputRef.current?.focus(); } catch {} }} onMore={() => {}} />

        <div

          className="sticky z-30 bg-white/85 backdrop-blur border-b border-gray-100 -mx-4 px-4"

          style={{ top: "calc(env(safe-area-inset-top) + var(--siddes-topbar-h))" }}

          data-testid="thread-header"

        >

          <div className="flex items-center justify-between py-3">

          <div className="flex items-center">
            <Link href={backHref} className="text-sm font-extrabold text-gray-700 hover:underline">
              ← {backLabel}
            </Link>
            <Badge n={queuedCount} />
          </div>

          {/* sd_950: composer moved to sticky footer */}



          <QueuedReplies postId={found.post.id} />
<SentReplies
  postId={found.post.id}
  onReplyTo={(parentId, label) => {
    setReplyTo({ parentId, label });
    try {
      replyInputRef.current?.focus();
    } catch {
      // ignore
    }
  }}
  onCountChange={setSentReplyCount}
/>
        </div>
        </div>
      </ContentColumn>


      <div

        className="fixed left-0 right-0 z-[95] bottom-[calc(88px+env(safe-area-inset-bottom))] lg:bottom-0"

        data-testid="thread-fixed-composer"

      >

        <div className="w-full max-w-[680px] mx-auto px-4">

          <div className="bg-white border border-gray-200 rounded-3xl shadow-[0_-12px_32px_rgba(0,0,0,0.08)]">

            {mismatch ? (

              <div className="p-4 flex items-center justify-between gap-3">

                <div className="text-sm font-bold text-gray-700">

                  Enter <span className={theme.text}>{postMeta.label}</span> to reply.

                </div>

                <button

                  type="button"

                  className={cn("px-4 py-2 rounded-full text-white text-sm font-extrabold hover:opacity-90", theme.primaryBg)}

                  onClick={enterSide}

                >

                  Enter {postMeta.label}

                </button>

              </div>

            ) : (

              <div className="p-3" data-testid="thread-inline-composer">

                {replyError ? (

                  <div className="text-xs font-extrabold text-rose-600 mb-2">{replyError.message}</div>

                ) : null}


                {replyTo ? (

                  <div className="flex items-center justify-between gap-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">

                    <span className="truncate">{/* sd_955_replying_to_jump: TODO - Replying-to indicator drifted; jumpToReply is available */}
Replying to {replyTo.label}</span>

                    <button

                      type="button"

                      className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"

                      onClick={() => setReplyTo(null)}

                    >

                      Clear

                    </button>

                  </div>

                ) : null}


                <div className="flex gap-3">

                  <ReplyAvatar label="You" tone="neutral" />

                  <div className="flex-1 min-w-0">

                    <textarea

                      ref={replyInputRef}

                      value={replyText}

                      onChange={(e) => {

                        setReplyText(e.target.value);

                        try {

                          const el = e.target as HTMLTextAreaElement;

                          el.style.height = "auto";

                          el.style.height = Math.min(el.scrollHeight, 160) + "px";

                        } catch {}

                      }}

                      placeholder="Add a reply…"

                      className="w-full py-2 resize-none bg-transparent outline-none text-base font-bold placeholder:text-gray-400 leading-5"

                      rows={1}

                      onKeyDown={(e) => {

                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {

                          e.preventDefault();

                          sendReplyNow();

                          return;

                        }

                        if (e.key === "Enter" && !e.shiftKey) {

                          e.preventDefault();

                          sendReplyNow();

                        }

                      }}

                      aria-label="Write a reply"

                    />

                  </div>

                  <button

                    type="button"

                    onClick={sendReplyNow}

                    disabled={replyBusy || !replyText.trim()}

                    className={cn(

                      "px-4 py-2 rounded-full text-sm font-extrabold text-white",

                      (replyBusy || !replyText.trim()) ? "bg-gray-200 cursor-not-allowed" : theme.primaryBg

                    )}

                  >

                    {replyBusy ? "Sending…" : "Send"}

                  </button>

                </div>

              </div>

            )}

          </div>

        </div>

      </div>


      </div>
  );
}


export default function SiddesPostDetailPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-gray-400">Loading…</div>}>
      <PostDetailInner />
    </Suspense>
  );
}


// sd_970_fix_post_detail_reply_json_once_missing_helper


// sd_971_fix_post_detail_reply_json_once_helper


// sd_951_v5_post_hero_force_replace


// sd_955_replying_to_jump
