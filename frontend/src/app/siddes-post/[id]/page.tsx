"use client";
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
import { getSetsProvider } from "@/src/lib/setsProvider";
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
          {replies.map((r) => {
            const mine = viewerId ? r.authorId === viewerId : isStubMe(r.authorId);

            const name = mine
              ? "You"
              : (r.author || (r.handle ? String(r.handle).replace(/^@/, "") : "") || "Unknown");

            const handleRaw = !mine ? String(r.handle || "").trim() : "";
            const handle = handleRaw ? (handleRaw.startsWith("@") ? handleRaw : "@" + handleRaw) : "";

            const profileSlug = (() => {
              const raw = String(r.handle || "").trim();
              const u = raw.replace(/^@/, "").split(/\s+/)[0];
              return u ? u : null;
            })();
            const profileHref = profileSlug ? `/u/${encodeURIComponent(profileSlug)}` : null;

            const depth = Math.max(0, Math.min(3, Number((r as any).depth || 0)));
            const indentPx = depth * 18;

            const when = (() => {
              try {
                return new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              } catch {
                return "";
              }
            })();

            const header = (
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-extrabold text-gray-900 text-sm truncate">{name}</span>
                {handle ? <span className="text-xs font-bold text-gray-400 truncate">{handle}</span> : null}
              </div>
            );

            return (
              <div key={r.id} style={{ marginLeft: indentPx }}>
                <div
                  className={cn(
                    "rounded-2xl border p-4",
                    mine ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {profileHref ? (
                      <Link href={profileHref} className="shrink-0" title="View profile">
                        <ReplyAvatar label={name} tone="neutral" />
                      </Link>
                    ) : (
                      <div className="shrink-0">
                        <ReplyAvatar label={name} tone="neutral" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          {profileHref ? (
                            <Link
                              href={profileHref}
                              className="inline-flex items-baseline gap-2 min-w-0 hover:underline"
                              title="View profile"
                            >
                              {header}
                            </Link>
                          ) : (
                            header
                          )}
                        </div>

                        {when ? (
                          <span className="text-gray-400 text-xs tabular-nums shrink-0">{when}</span>
                        ) : null}
                      </div>

                      <div className="text-sm text-gray-900 leading-relaxed mt-1 whitespace-pre-wrap">{r.text}</div>

                      {/* sd_924_no_nested_reply_action: backend limits nesting; hide Reply on depth>0 */}

                      {/* sd_927_no_nested_reply_action: backend limits nesting; hide Reply on depth>0 */}
{depth === 0 ? (
  <div className="mt-3">
    <button
      type="button"
      className="px-3 py-2 rounded-full border border-gray-200 bg-white text-xs font-extrabold text-gray-800 hover:bg-gray-50 active:bg-gray-50/70"
      onClick={() => onReplyTo?.(r.id, name)}
      aria-label="Reply"
      title="Reply"
    >
      Reply
    </button>
  </div>
) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
        p.startsWith("/siddes-sets") ||
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
    if (r.startsWith("/siddes-sets")) return "Sets";
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
      body: JSON.stringify({ text: t, parentId, client_key: `reply_${Date.now().toString(36)}` }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (!data || data.ok !== false) {
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

    const j = await res.json().catch(() => null);
    const code = j && typeof j.error === "string" ? j.error : "request_failed";

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
}, [found, activeSide, replyText, replyTo, replyBusy]);



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
// Enrich post with Set metadata for private sides so ContextStamp shows the real Set name/color.
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

    const setsProvider = getSetsProvider();
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

  return (
    <div className="py-4 pb-28">
      <ContentColumn>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Link href={backHref} className="text-sm font-extrabold text-gray-700 hover:underline">
              ← {backLabel}
            </Link>
            <Badge n={queuedCount} />
          </div>

          {mismatch ? (
            <button
              type="button"
              className={cn(
                "px-4 py-2 rounded-full text-white text-sm font-extrabold hover:opacity-90",
                theme.primaryBg
              )}
              onClick={enterSide}
            >
              Enter {postMeta.label}
            </button>
          ) : null}
        </div>

        <SideMismatchBanner active={activeSide} target={postSide} onEnter={enterSide} />

        <PostCard
          post={found.post}
          side={found.side}
          calmHideCounts={found.side === "public" && FLAGS.publicCalmUi && !(publicCalm?.showCounts)}
        />

        <div className="mt-4 rounded-3xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Replies{typeof sentReplyCount === "number" ? ` (${sentReplyCount})` : ""}</div>
              <div className="text-xs text-gray-500 mt-1">Replies stay in the same Side.</div>
            </div>
            {mismatch ? (
              <button
                type="button"
                onClick={enterSide}
                className={cn(
                  "px-3 py-2 rounded-full text-sm font-extrabold text-white hover:opacity-90",
                  theme.primaryBg
                )}
              >
                Enter {postMeta.label}
              </button>
            ) : null}
          </div>

          
          {mismatch ? (
            <div className="mt-4 flex items-center justify-between gap-3">
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
            <div className="mt-4" data-testid="thread-inline-composer">
              {replyError ? (
                <div className="text-xs font-extrabold text-rose-600 mb-2">{replyError.message}</div>
              ) : null}

              {replyTo ? (
                <div className="flex items-center justify-between gap-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">
                  <span className="truncate">Replying to {replyTo.label}</span>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                    onClick={() => setReplyTo(null)}
                  >
                    Clear
                  </button>
                </div>
              ) : null}

              <div className="flex gap-3 py-4 border-t border-b border-gray-100">
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
      </ContentColumn>

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
