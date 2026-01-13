"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { SideId } from "@/src/lib/sides";
import type { FeedPost } from "@/src/lib/mockFeed";
import { findPostById, shouldOpenReply } from "@/src/lib/postLookup";
import { PostCard } from "@/src/components/PostCard";
import { FLAGS } from "@/src/lib/flags";
import { EVT_PUBLIC_CALM_UI_CHANGED, loadPublicCalmUi, type PublicCalmUiState } from "@/src/lib/publicCalmUi";
import { ReplyComposer } from "@/src/components/ReplyComposer";
import {
  enqueueReply,
  countQueuedRepliesForPost,
  listQueuedRepliesForPost,
  queueChangedEventName,
} from "@/src/lib/offlineQueue";

type Found = { post: FeedPost; side: SideId } | null;
const USE_API = process.env.NEXT_PUBLIC_FEED_PROVIDER === "backend_stub";

type StoredReply = { id: string; postId: string; text: string; createdAt: number };

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
      Queued reply{n === 1 ? "" : "ies"}: {n}
    </span>
  );
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
    <div className="mt-4" data-testid="queued-replies">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Queued replies</div>
      <div className="space-y-2">
        {replies.map((r) => (
          <div key={r.id} className="p-3 rounded-2xl border border-amber-200 bg-amber-50">
            <div className="flex justify-between text-xs text-amber-800 mb-1">
              <span className="font-bold">Queued</span>
              <span>{new Date(r.createdAt).toLocaleTimeString()}</span>
            </div>
            <div className="text-sm text-gray-900">{r.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentReplies({ postId }: { postId: string }) {
  const [replies, setReplies] = useState<StoredReply[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!USE_API) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/post/${encodeURIComponent(postId)}/replies`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setReplies((data.replies || []) as StoredReply[]);
    } finally {
      setLoading(false);
    }


  }, [postId]);



  useEffect(() => {


    if (!USE_API) return;


    refresh();


  }, [postId, refresh]);

  if (!USE_API) return null;

  return (
    <div className="mt-4" data-testid="sent-replies">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Replies</div>
        <button
          type="button"
          className="text-xs font-bold text-gray-600 hover:underline"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {replies.length ? (
        <div className="space-y-2">
          {replies.map((r) => (
            <div key={r.id} className="p-3 rounded-2xl border border-gray-200 bg-white">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span className="font-bold text-gray-700">Sent</span>
                <span>{new Date(r.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="text-sm text-gray-900">{r.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400">No replies yet.</div>
      )}
    </div>
  );
}

function PostDetailInner() {
  const params = useParams();
  const sp = useSearchParams();
  const id = (params?.id as string) || "";

  const [found, setFound] = useState<Found>(null);
  const [loading, setLoading] = useState(false);

  const [replyOpen, setReplyOpen] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

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
    if (sp && shouldOpenReply(sp)) setReplyOpen(true);
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
      if (!USE_API) {
        const local = findPostById(id);
        if (mounted) setFound(local);
        return;
      }

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

  if (loading && !found) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading…</div>;
  }

  if (!found) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6">
          <div className="text-lg font-bold text-gray-900">Post not found</div>
          <p className="text-sm text-gray-500 mt-2">
            This is a mock-backed route for now. (Source: {USE_API ? "api" : "local"})
          </p>
          <Link href="/siddes-feed" className="inline-block mt-4 text-sm font-bold text-gray-700 hover:underline">
            ← Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/siddes-feed" className="text-sm font-bold text-gray-700 hover:underline">
            ← Feed
          </Link>
          <Badge n={queuedCount} />
        </div>

        <button
          type="button"
          className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:opacity-90"
          onClick={() => setReplyOpen(true)}
        >
          Reply
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-10">
        <PostCard post={found.post} side={found.side} calmHideCounts={found.side === "public" && FLAGS.publicCalmUi && !(publicCalm?.showCounts)} />

        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="text-sm font-bold text-gray-900">Thread</div>
          <div className="text-xs text-gray-500 mt-1">Queued replies appear below until sent.</div>

          <QueuedReplies postId={found.post.id} />
          <SentReplies postId={found.post.id} />
        </div>
      </div>

      <ReplyComposer
        open={replyOpen}
        onClose={() => setReplyOpen(false)}
        post={found.post}
        onSend={async (text) => {
          if (!text) return;

          if (!isOnline) {
            enqueueReply(found.side, found.post.id, text);
            setReplyOpen(false);
            alert("Reply queued (offline).");
            return;
          }

          if (USE_API) {
            const res = await fetch(`/api/post/${encodeURIComponent(found.post.id)}/reply`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ text, client_key: `live_${Date.now().toString(36)}` }),
            });
            if (res.ok) {
              setReplyOpen(false);
              alert("Reply sent (stub) and stored.");
              return;
            }
          }

          setReplyOpen(false);
          alert(`Replied (stub): ${text}`);
        }}
      />
    </div>
  );
}

export default function SiddesPostDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading…</div>}>
      <PostDetailInner />
    </Suspense>
  );
}
