"use client";
export const dynamic = "force-dynamic";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import type { FeedPost } from "@/src/lib/feedTypes";
import { PostCard } from "@/src/components/PostCard";
import { FLAGS } from "@/src/lib/flags";
import type { PublicCalmUiState } from "@/src/lib/publicCalmUi";
import { EVT_PUBLIC_CALM_UI_CHANGED, loadPublicCalmUi } from "@/src/lib/publicCalmUi";
import { ReplyComposer } from "@/src/components/ReplyComposer";
import { ContentColumn } from "@/src/components/ContentColumn";
import { toast } from "@/src/lib/toast";
import { getStubViewerCookie, isStubMe } from "@/src/lib/stubViewerClient";
import { fetchMe } from "@/src/lib/authMe";
import { getSetsProvider } from "@/src/lib/setsProvider";
import {
  enqueueReply,
  countQueuedRepliesForPost,
  listQueuedRepliesForPost,
  queueChangedEventName,
  removeQueuedItem,
} from "@/src/lib/offlineQueue";

type Found = { post: FeedPost; side: SideId } | null;

type StoredReply = { id: string; postId: string; authorId: string; author?: string; handle?: string; text: string; createdAt: number; clientKey?: string | null };

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

function SentReplies({ postId }: { postId: string }) {
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
        return;
      }
      const data = await res.json();
      setReplies((data.replies || []) as StoredReply[]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

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

  // Auto-refresh replies when a reply is sent or when offline queue flushes.
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
    <div className="mt-4" data-testid="sent-replies">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Replies</div>
        <button
          type="button"
          className="text-xs font-extrabold text-gray-600 hover:underline"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {replies.length ? (
        <div className="space-y-2">
          {replies.map((r) => {
            const mine = viewerId ? r.authorId === viewerId : isStubMe(r.authorId);
            const who = mine ? "You" : (r.author || r.handle || r.authorId || "Unknown");
            return (
              <div key={r.id} className="p-3 rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-start gap-3">
                  <ReplyAvatar label={who} tone="neutral" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span className="font-extrabold text-gray-900 truncate">{who}</span>
                      <span className="tabular-nums text-gray-400">{new Date(r.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-sm text-gray-900 leading-relaxed">{r.text}</div>
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
            You're currently in <span className="font-bold">{a.label}</span>. To reply safely, enter {t.label}.
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
  const id = (params?.id as string) || "";

  const { side: activeSide, setSide } = useSide();

  const [found, setFound] = useState<Found>(null);
  const [loading, setLoading] = useState(false);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<ReplySendError | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    if (!replyOpen) return;
    setReplyBusy(false);
    setReplyError(null);
  }, [replyOpen]);

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
    if (shouldOpenReply(sp)) setReplyOpen(true);
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

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/post/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!mounted) return;
        if (!res.ok) {
          setFound(null);
          return;
        }
        const data = await res.json();
        if (data?.ok) {
          setFound({ post: data.post, side: data.side });
        } else {
          setFound(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
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

  if (loading && !found) {
    return (
      <div className="py-10">
        <ContentColumn>
          <div className="text-center text-gray-400">Loading…</div>
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
            <Link href="/siddes-feed" className="inline-block mt-4 text-sm font-extrabold text-gray-700 hover:underline">
              ← Back to feed
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
    <div className="py-4">
      <ContentColumn>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Link href="/siddes-feed" className="text-sm font-extrabold text-gray-700 hover:underline">
              ← Feed
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
          ) : (
            <button
              type="button"
              className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-extrabold hover:opacity-90"
              onClick={() => setReplyOpen(true)}
            >
              Reply
            </button>
          )}
        </div>

        <SideMismatchBanner active={activeSide} target={postSide} onEnter={enterSide} />

        <PostCard
          post={found.post}
          side={found.side}
          calmHideCounts={found.side === "public" && FLAGS.publicCalmUi && !(publicCalm?.showCounts)}
        />

        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Thread</div>
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
            ) : (
              <button
                type="button"
                onClick={() => setReplyOpen(true)}
                className="px-3 py-2 rounded-full border border-gray-200 bg-white text-sm font-extrabold text-gray-800 hover:bg-gray-100"
              >
                Add reply
              </button>
            )}
          </div>

          <QueuedReplies postId={found.post.id} />
          <SentReplies postId={found.post.id} />
        </div>
      </ContentColumn>

      <ReplyComposer
        open={replyOpen}
        onClose={() => {
          setReplyOpen(false);
          setReplyBusy(false);
          setReplyError(null);
        }}
        post={found.post}
        side={found.side}
        busy={replyBusy}
        error={replyError}
        maxLen={2000}
        onSend={async (text) => {
          const t = String(text || "").trim();
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

          // Offline: queue and close (undo).
          if (!onlineNow) {
            const queued = enqueueReply(found.side, found.post.id, t);
            setReplyOpen(false);
            setReplyBusy(false);
            toast.undo("Reply queued (offline).", () => removeQueuedItem(queued.id));
            return;
          }

          try {
            const res = await fetch(`/api/post/${encodeURIComponent(found.post.id)}/reply`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ text: t, client_key: `reply_${Date.now().toString(36)}` }),
            });

            if (res.ok) {
              const data = await res.json().catch(() => null);
              if (!data || data.ok !== false) {
                setReplyOpen(false);
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
        }}
      />

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
