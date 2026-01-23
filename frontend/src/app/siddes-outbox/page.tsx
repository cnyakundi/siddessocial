"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSide } from "@/src/components/SideProvider";
import { SIDES as SIDE_META, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import {
  loadQueue,
  flushQueue,
  removeQueuedItem,
  queueChangedEventName,
  type QueueItem,
  type QueuedPost,
  type QueuedReply,
} from "@/src/lib/offlineQueue";
import { CloudOff, RefreshCw, Trash2, Wifi, WifiOff, FileText, MessageCircle } from "lucide-react";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function formatAgo(ts: number) {
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

function kindLabel(it: QueueItem) {
  return it.kind === "post" ? "Post" : "Reply";
}

function kindIcon(it: QueueItem) {
  return it.kind === "post" ? FileText : MessageCircle;
}

function itemSubline(it: QueueItem) {
  if (it.kind === "post") {
    const p = it as QueuedPost;
    return p.setId ? `Set: ${p.setId}` : "All";
  }
  const r = it as QueuedReply;
  return `Post: ${r.postId}`;
}

function itemTitle(it: QueueItem) {
  const t = (it.text || "").trim();
  return t.length ? t : "(empty)";
}

export default function SiddesOutboxPage() {
  const { side } = useSide();
  const theme = SIDE_THEMES[side];
  const meta = SIDE_META[side];

  const [items, setItems] = useState<QueueItem[]>([]);
  const [filterSide, setFilterSide] = useState<SideId | "all">(side);
  const [flushing, setFlushing] = useState(false);
  const [online, setOnline] = useState<boolean>(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  const refresh = () => setItems(loadQueue());

  useEffect(() => {
    refresh();
    const evt = queueChangedEventName();
    const onChanged = () => refresh();
    window.addEventListener(evt, onChanged);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener(evt, onChanged);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Keep default filter aligned to active side (unless user chose "all")
  useEffect(() => {
    setFilterSide((cur) => (cur === "all" ? "all" : side));
  }, [side]);

  const countsBySide = useMemo(() => {
    const base: Record<string, number> = { public: 0, friends: 0, close: 0, work: 0 };
    for (const it of items) base[it.side] = (base[it.side] || 0) + 1;
    return base as Record<SideId, number>;
  }, [items]);

  const postsCount = useMemo(() => items.filter((x) => x.kind === "post").length, [items]);
  const repliesCount = useMemo(() => items.filter((x) => x.kind === "reply").length, [items]);

  const filtered = useMemo(() => {
    const base = filterSide === "all" ? items : items.filter((x) => x.side === filterSide);
    return base.slice().sort((a, b) => b.createdAt - a.createdAt);
  }, [items, filterSide]);

  return (
    <div className="px-4 lg:px-8 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-black tracking-tight text-gray-900">Outbox</div>
            <div className="text-xs text-gray-500 mt-1">
              Queued posts and replies saved on-device. Sent when online.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                "px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                online ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
              )}
              title={online ? "Online" : "Offline"}
            >
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}
              {online ? "Online" : "Offline"}
            </div>

            <button
              type="button"
              disabled={items.length === 0 || flushing}
              onClick={async () => {
                setFlushing(true);
                try {
                  await flushQueue();
                } finally {
                  setFlushing(false);
                  refresh();
                }
              }}
              className={cn(
                "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all",
                items.length === 0 || flushing
                  ? "bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed"
                  : "bg-gray-900 text-white border-transparent hover:opacity-95 active:scale-95"
              )}
            >
              <RefreshCw size={14} className={flushing ? "animate-spin" : ""} />
              {flushing ? "Sending" : "Send now"}
            </button>
          </div>
        </div>

        {/* Side filter chips */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterSide("all")}
            className={cn(
              "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
              filterSide === "all" ? "bg-gray-900 text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            )}
          >
            All ({items.length})
          </button>

          {(["public", "friends", "close", "work"] as SideId[]).map((s) => {
            const t = SIDE_THEMES[s];
            const c = countsBySide[s] || 0;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilterSide(s)}
                className={cn(
                  "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                  filterSide === s ? cn(t.lightBg, t.text, "border-transparent") : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", t.primaryBg)} />
                {SIDE_META[s].label} ({c})
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Queued</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{items.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Posts</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{postsCount}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Replies</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{repliesCount}</div>
          </div>
        </div>

        {/* List */}
        <div className="mt-8 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-20 text-center bg-white border border-dashed border-gray-200 rounded-[2.5rem]">
              <div className="text-sm font-bold text-gray-700">Nothing queued.</div>
              <div className="text-xs text-gray-400 mt-2">You’re fully synced for this filter.</div>
              <div className="mt-6">
                <Link href="/siddes-feed" className="text-xs font-extrabold text-gray-900 hover:underline">
                  Back to Feed
                </Link>
              </div>
            </div>
          ) : (
            filtered.map((it) => {
              const t = SIDE_THEMES[it.side];
              const Icon = kindIcon(it);
              const isReply = it.kind === "reply";
              const postId = isReply ? (it as QueuedReply).postId : null;

              return (
                <div key={it.id} className="bg-white border border-gray-200 rounded-[2.5rem] p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border border-white shadow-sm", t.lightBg)}>
                        <Icon size={20} className={t.text} strokeWidth={2.5} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white", t.primaryBg)}>
                            {kindLabel(it)}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">{SIDE_META[it.side].label}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">• {formatAgo(it.createdAt)}</span>
                        </div>

                        <div className="text-sm font-bold text-gray-900 truncate">{itemTitle(it)}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{itemSubline(it)}</div>

                        {isReply && postId ? (
                          <div className="mt-2">
                            <Link
                              href={`/siddes-post/${encodeURIComponent(String(postId))}`}
                              className="text-xs font-extrabold text-gray-700 hover:underline"
                            >
                              Open thread
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        removeQueuedItem(it.id);
                        refresh();
                      }}
                      className="p-3 rounded-2xl bg-white border border-gray-200 text-gray-400 hover:text-rose-600 hover:border-rose-200 transition-colors"
                      title="Remove from outbox"
                      aria-label="Remove from outbox"
                    >
                      <Trash2 size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 text-center">
          Context locked • Outbox is on-device
        </div>
      </div>
    </div>
  );
}
