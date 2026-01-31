"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Repeat, Share2, MoreHorizontal } from "lucide-react";
import type { SideId } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type ThemeLike = { text?: string; primaryBg?: string; lightBg?: string; border?: string };

type PostLike = {
  id: string;
  author?: { name?: string; handle?: string; avatarUrl?: string | null };
  authorName?: string;
  handle?: string;
  avatarUrl?: string | null;
  time?: string;
  content?: string;
  text?: string;
  likeCount?: number;
  likes?: number;
  replyCount?: number;
  replies?: number;
  liked?: boolean;
};

function safeText(p: PostLike): string {
  return String((p as any)?.content ?? (p as any)?.text ?? "");
}
function safeName(p: PostLike): string {
  return String((p as any)?.author?.name || (p as any)?.authorName || "User");
}
function safeHandle(p: PostLike): string {
  const h = String((p as any)?.author?.handle || (p as any)?.handle || "").trim();
  if (!h) return "@user";
  return h.startsWith("@") ? h : "@" + h;
}
function safeAvatar(p: PostLike): string | null {
  const a = (p as any)?.author?.avatarUrl ?? (p as any)?.avatarUrl ?? null;
  return a ? String(a) : null;
}
function countNum(v: any): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function PostHero({
  post,
  side,
  theme,
  onReply,
  onMore,
}: {
  post: any;
  side: SideId;
  theme?: ThemeLike;
  onReply?: () => void;
  onMore?: () => void;
}) {
  const router = useRouter();
  const p = post as PostLike;

  const name = useMemo(() => safeName(p), [p]);
  const handle = useMemo(() => safeHandle(p), [p]);
  const avatarUrl = useMemo(() => safeAvatar(p), [p]);
  const text = useMemo(() => safeText(p), [p]);

  const [liked, setLiked] = useState(Boolean((p as any)?.liked));
  const [likeBusy, setLikeBusy] = useState(false);

  const likeCount = useMemo(() => countNum((p as any)?.likeCount ?? (p as any)?.likes), [p]);
  const replyCount = useMemo(() => countNum((p as any)?.replyCount ?? (p as any)?.replies), [p]);
  const timeLabel = useMemo(() => String((p as any)?.time || "").trim(), [p]);

  const goProfile = () => {
    const raw = String((p as any)?.author?.handle || (p as any)?.handle || "").trim();
    const u = raw.startsWith("@") ? raw.slice(1) : raw;
    if (u) router.push(`/u/${encodeURIComponent(u)}`);
  };

  const toggleLike = async () => {
    if (likeBusy) return;
    const id = String((p as any)?.id || "").trim();
    if (!id) return;

    setLikeBusy(true);
    const next = !liked;
    setLiked(next);
    try {
      const res = await fetch(`/api/post/${encodeURIComponent(id)}/like`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ liked: next }),
      });
      if (!res.ok) setLiked(!next);
    } catch {
      setLiked(!next);
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <div className="bg-white">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <button type="button" onClick={goProfile} className="flex items-start gap-3 text-left min-w-0">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-black">
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-black text-gray-900 truncate">{name}</div>
              {timeLabel ? <div className="text-xs text-gray-400">· {timeLabel}</div> : null}
            </div>
            <div className="text-sm text-gray-500 truncate">{handle}</div>
          </div>
        </button>

        <button type="button" onClick={onMore} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="text-[17px] leading-relaxed text-gray-900 whitespace-pre-wrap">{text}</div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            <span className={cn("font-black", theme?.text)}>{side}</span>
          </div>
          <div />
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
          <span className="font-black text-gray-900">{likeCount}</span>
          <span className="text-gray-500">likes</span>
          <span className="text-gray-300 mx-1">•</span>
          <span className="font-black text-gray-900">{replyCount}</span>
          <span className="text-gray-500">replies</span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={toggleLike}
            disabled={likeBusy}
            className={cn(
              "min-w-[48px] min-h-[48px] px-3 rounded-full inline-flex items-center gap-2 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60",
              liked ? "text-rose-600" : "text-gray-600"
            )}
          >
            <Heart size={20} fill={liked ? "currentColor" : "none"} />
            <span className="hidden sm:inline">React</span>
          </button>

          <button
            type="button"
            onClick={() => { try { onReply?.(); } catch {} }}
            className="min-w-[48px] min-h-[48px] px-3 rounded-full inline-flex items-center gap-2 text-sm font-extrabold text-gray-600 hover:bg-gray-50"
          >
            <MessageCircle size={20} />
            <span className="hidden sm:inline">Reply</span>
          </button>

          <button type="button" className="min-w-[48px] min-h-[48px] px-3 rounded-full inline-flex items-center gap-2 text-sm font-extrabold text-gray-600 hover:bg-gray-50">
            <Repeat size={20} />
            <span className="hidden sm:inline">Echo</span>
          </button>

          <button type="button" className="min-w-[48px] min-h-[48px] px-3 rounded-full inline-flex items-center gap-2 text-sm font-extrabold text-gray-600 hover:bg-gray-50">
            <Share2 size={20} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />
    </div>
  );
}
