#!/usr/bin/env bash
set -euo pipefail

NAME="sd_607_perf_feed_postrowlite_split"
TS=$(date +%Y%m%d_%H%M%S)
ROOT=$(pwd)

if [ ! -d "frontend/src" ] || [ ! -d "backend" ]; then
  echo "ERROR: Run this from your repo root (folder containing frontend/ and backend/)."
  echo "Current: $ROOT"
  exit 1
fi

BK_DIR=".backup_${NAME}_${TS}"
mkdir -p "$BK_DIR"

echo "== $NAME =="
echo "Backups: $BK_DIR"
echo ""

SIDEFEED="frontend/src/components/SideFeed.tsx"
ROWFILE="frontend/src/components/PostRowLite.tsx"

if [ ! -f "$SIDEFEED" ]; then
  echo "ERROR: missing $SIDEFEED"
  exit 1
fi

mkdir -p "$BK_DIR/$(dirname "$SIDEFEED")"
cp "$SIDEFEED" "$BK_DIR/$SIDEFEED"

if [ -f "$ROWFILE" ]; then
  mkdir -p "$BK_DIR/$(dirname "$ROWFILE")"
  cp "$ROWFILE" "$BK_DIR/$ROWFILE"
fi

# 1) Write PostRowLite.tsx (idempotent)
if [ -f "$ROWFILE" ] && grep -q "sd_607_postrowlite" "$ROWFILE"; then
  echo "OK: $ROWFILE already exists (marker found)"
else
  cat > "$ROWFILE" <<'EOF'
"use client";

/* eslint-disable @next/next/no-img-element */

// sd_607_postrowlite: ultra-light feed row renderer (cuts per-row hooks/jank)

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Heart, MessageCircle, MoreHorizontal, Play } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import type { FeedPost } from "@/src/lib/feedTypes";
import type { Chip } from "@/src/lib/chips";
import { buildChips, chipsFromPost } from "@/src/lib/chips";
import { toast } from "@/src/lib/toast";
import { saveReturnScroll } from "@/src/hooks/returnScroll";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function formatDurationMs(ms?: number): string {
  const n = typeof ms === "number" ? Math.floor(ms) : 0;
  if (!n || n <= 0) return "";
  const total = Math.max(0, Math.round(n / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const AVATAR_STYLES = [
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-yellow-100 text-yellow-800 border-yellow-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  "bg-stone-100 text-stone-800 border-stone-200",
  "bg-zinc-100 text-zinc-800 border-zinc-200",
  "bg-gray-100 text-gray-800 border-gray-200",
] as const;

function hashToIndex(seed: string, mod: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return mod > 0 ? h % mod : 0;
}

function initialsFrom(name?: string, handle?: string) {
  const base = (name && name.trim()) || (handle && handle.replace(/^@/, "").trim()) || "U";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] ? parts[0][0] : "U").toUpperCase();
  const a = parts[0][0] || "U";
  const b = parts[parts.length - 1][0] || "U";
  return (a + b).toUpperCase();
}

function Avatar({ name, handle, avatarUrl }: { name?: string; handle?: string; avatarUrl?: string | null }) {
  const seed = String((handle || name || "siddes").toLowerCase());
  const idx = hashToIndex(seed, AVATAR_STYLES.length);
  const initials = initialsFrom(name, handle);
  const url = String(avatarUrl || "").trim();

  if (url) {
    return (
      <div
        className={cn(
          "w-11 h-11 lg:w-14 lg:h-14 rounded-full border flex items-center justify-center font-extrabold text-sm flex-shrink-0 select-none overflow-hidden bg-gray-100",
          "border-gray-200"
        )}
        aria-hidden="true"
        title={name || handle || "User"}
      >
        <img src={url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-11 h-11 lg:w-14 lg:h-14 rounded-full border flex items-center justify-center font-extrabold text-sm flex-shrink-0 select-none",
        AVATAR_STYLES[idx]
      )}
      aria-hidden="true"
      title={name || handle || "User"}
    >
      {initials}
    </div>
  );
}

function ContextStamp({ side, context }: { side: SideId; context?: string | null }) {
  const theme = SIDE_THEMES[side];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border",
        theme.lightBg,
        theme.text,
        theme.border
      )}
      aria-label={context ? `${SIDES[side].label}: ${context}` : `${SIDES[side].label}`}
      title={context ? `${SIDES[side].label} • ${context}` : SIDES[side].label}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", theme.primaryBg)} aria-hidden="true" />
      <span className="font-bold uppercase">{SIDES[side].label}</span>
      {context ? (
        <span className="font-medium opacity-80 border-l border-current/20 pl-1.5 ml-0.5 truncate max-w-[180px]">
          {context}
        </span>
      ) : null}
    </span>
  );
}

type MediaItem = {
  id: string;
  url: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  durationMs?: number;
};

function MediaGridLite({ items, onOpenPost }: { items: MediaItem[]; onOpenPost: () => void }) {
  const count = Array.isArray(items) ? items.length : 0;
  if (!count) return null;

  const shown = items.slice(0, 4);
  const cols = shown.length === 1 ? 1 : 2;

  return (
    <div className={cn("grid gap-2 mb-3", cols === 1 ? "grid-cols-1" : "grid-cols-2")}>
      {shown.map((m) => {
        const ratio = m.width && m.height ? `${m.width} / ${m.height}` : undefined;
        return (
          <button
            key={m.id}
            type="button"
            className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
            style={ratio ? ({ aspectRatio: ratio } as any) : undefined}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenPost();
            }}
            aria-label={m.kind === "video" ? "Open video" : "Open image"}
          >
            {m.kind === "image" ? (
              <img src={m.url} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <div className="w-12 h-12 rounded-full bg-white/80 border border-white/60 flex items-center justify-center text-gray-700">
                  <Play size={22} />
                </div>
                {m.durationMs ? (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-bold tabular-nums">
                    {formatDurationMs(m.durationMs)}
                  </div>
                ) : null}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PostRowLite({
  post,
  side,
  onMore,
  onPatchPost,
  calmHideCounts,
  variant,
  avatarUrl,
}: {
  post: FeedPost;
  side: SideId;
  onMore?: (post: FeedPost) => void;
  onPatchPost?: (id: string, patch: Partial<FeedPost>) => void;
  calmHideCounts?: boolean;
  variant?: "card" | "row"; // compatibility with existing callsites (ignored)
  avatarUrl?: string | null;
}) {
  void variant;

  const router = useRouter();
  const prefetchedRef = useRef(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const theme = SIDE_THEMES[side];
  void calmHideCounts;

  const allChips: Chip[] = useMemo(() => buildChips(chipsFromPost(post), { side }), [post, side]);
  const topicChip = allChips.find((c) => c.id === "topic") || null;
  const setChip = allChips.find((c) => c.id === "set") || null;
  const contextChip = side === "public" ? (topicChip || setChip) : setChip;

  const signalChips = allChips.filter((c) => c.id !== "topic" && c.id !== "set");
  const visible = signalChips.slice(0, 1);
  const overflowCount = Math.max(0, signalChips.length - visible.length);

  const displayContent = String((post as any)?.content ?? post.content ?? "");
  const rawText = String(displayContent || "");
  const hasText = rawText.trim().length > 0;
  const PREVIEW_LIMIT = side === "public" ? 360 : 520;
  const isLongText = hasText && rawText.trim().length > PREVIEW_LIMIT;
  const shownText = !isLongText ? rawText : rawText.slice(0, PREVIEW_LIMIT).trimEnd() + "…";
  const isEdited = typeof (post as any)?.editedAt === "number";

  const mediaItems = useMemo(() => {
    const arr = (post as any)?.media;
    if (!Array.isArray(arr)) return [] as MediaItem[];
    return (arr as any[])
      .map((m: any) => {
        const url = String(m?.url || "");
        const id = String(m?.id || url);
        const k = String(m?.kind || "image").toLowerCase() === "video" ? "video" : "image";
        const w = Number(m?.width ?? m?.w ?? 0);
        const h = Number(m?.height ?? m?.h ?? 0);
        const d = Number(m?.durationMs ?? m?.duration_ms ?? m?.duration ?? 0);
        return {
          id,
          url,
          kind: k as any,
          width: Number.isFinite(w) && w > 0 ? w : undefined,
          height: Number.isFinite(h) && h > 0 ? h : undefined,
          durationMs: Number.isFinite(d) && d > 0 ? d : undefined,
        } as MediaItem;
      })
      .filter((m) => Boolean(m.url));
  }, [post]);

  const liked = Boolean((post as any)?.liked);
  const likeCount = (() => {
    const n = Number((post as any)?.likeCount ?? (post as any)?.likes ?? 0);
    return Number.isFinite(n) ? n : 0;
  })();

  const prefetchPost = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    try {
      router.prefetch("/siddes-post/" + post.id);
      router.prefetch("/siddes-post/" + post.id + "?reply=1");
    } catch {}
  };

  const openProfile = (handleOrName: string) => {
    const raw = String(handleOrName || "").trim();
    if (!raw) return;
    const h = raw.replace(/^@/, "");
    router.push("/u/" + encodeURIComponent(h));
  };

  const openPost = () => {
    try { saveReturnScroll(); } catch {}
    router.push("/siddes-post/" + encodeURIComponent(String(post.id)));
  };

  const openReply = () => {
    try { saveReturnScroll(); } catch {}
    router.push("/siddes-post/" + encodeURIComponent(String(post.id)) + "?reply=1");
  };

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);

    const prevLiked = liked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    const optimisticCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    onPatchPost?.(String(post.id), { liked: nextLiked, likeCount: optimisticCount, likes: optimisticCount });

    try {
      const res = await fetch(`/api/post/${encodeURIComponent(String(post.id))}/like`, {
        method: nextLiked ? "POST" : "DELETE",
        cache: "no-store",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || (j as any).ok !== true) throw new Error(String((j as any)?.error || "request_failed"));

      const serverLiked = typeof (j as any).liked === "boolean" ? (j as any).liked : nextLiked;
      const serverCount = typeof (j as any).likeCount === "number" ? (j as any).likeCount : optimisticCount;
      onPatchPost?.(String(post.id), { liked: serverLiked, likeCount: serverCount, likes: serverCount });
    } catch {
      onPatchPost?.(String(post.id), { liked: prevLiked, likeCount: prevCount, likes: prevCount });
      toast.error("Couldn't update like.");
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <div className="group py-5 border-b border-gray-100 hover:bg-gray-50/40 transition-colors" data-post-id={post.id}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div
          role="button"
          tabIndex={0}
          onMouseEnter={prefetchPost}
          onTouchStart={prefetchPost}
          onClick={(e) => {
            if ((e as any).defaultPrevented) return;
            try {
              const sel = typeof window !== "undefined" ? window.getSelection() : null;
              if (sel && sel.toString().trim().length > 0) return;
            } catch {}
            openPost();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") openPost();
            if (e.key === " ") { e.preventDefault(); openPost(); }
          }}
          className="flex gap-4 lg:gap-6 text-left cursor-pointer"
          aria-label="Open post"
        >
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openProfile(post.handle || post.author); }}
            className="rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20"
            aria-label={"Open profile " + String(post.handle || post.author || "user")}
            title="View profile"
          >
            <Avatar name={post.author} handle={post.handle} avatarUrl={avatarUrl} />
          </button>

          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openProfile(post.handle || post.author); }}
              className="flex items-center gap-2 min-w-0 text-left"
              aria-label={"Open profile " + String(post.handle || post.author || "user")}
              title="View profile"
            >
              <span className="font-black text-gray-900 truncate hover:underline text-[15px]">{post.author}</span>
              <span className="text-gray-400 truncate hover:underline text-[12px] font-bold">{post.handle}</span>
            </button>

            <div className="flex items-center gap-2 mt-1 flex-wrap min-w-0">
              <span className="text-xs text-gray-400">{post.time}</span>
              {isEdited ? (
                <>
                  <span className="text-gray-300 text-[10px]">•</span>
                  <span className="text-xs text-gray-400 font-semibold">Edited</span>
                </>
              ) : null}

              <span className="text-gray-300 text-[10px]">•</span>
              <ContextStamp side={side} context={contextChip?.label || null} />

              {visible.map((c) => (
                <span key={c.id} className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1", c.className)} title={c.label}>
                  <c.icon size={10} />
                  {c.label}
                </span>
              ))}

              {overflowCount > 0 ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200" title="More context">
                  +{overflowCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMore?.(post); }}
          className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          aria-label="Post options"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="pl-[60px] lg:pl-[72px]">
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            if ((e as any).defaultPrevented) return;
            try {
              const sel = typeof window !== "undefined" ? window.getSelection() : null;
              if (sel && sel.toString().trim().length > 0) return;
            } catch {}
            openPost();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") openPost();
            if (e.key === " ") { e.preventDefault(); openPost(); }
          }}
          className="w-full text-left rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20"
          aria-label="Open thread"
        >
          {hasText ? (
            <p className="text-gray-800 leading-relaxed mb-3 whitespace-pre-wrap text-[15px]">
              {shownText}
              {isLongText ? (
                <span className={cn("ml-1 text-xs font-extrabold underline-offset-2 hover:underline", theme.text)}>Read more</span>
              ) : null}
            </p>
          ) : null}

          <MediaGridLite items={mediaItems} onOpenPost={openPost} />
        </div>

        {/* Footer actions */}
        <div className="mt-2 flex items-center gap-6 transition-opacity duration-200 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
          <button
            type="button"
            className="min-w-[44px] min-h-[44px] px-2 rounded-full inline-flex items-center gap-2 text-xs font-extrabold text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20"
            aria-label="Reply"
            title="Reply"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openReply(); }}
          >
            <MessageCircle size={18} strokeWidth={2.5} />
            Reply
          </button>

          <button
            type="button"
            className={cn(
              "min-w-[44px] min-h-[44px] px-2 rounded-full inline-flex items-center gap-2 text-xs font-extrabold hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20 disabled:opacity-60",
              liked ? theme.text : "text-gray-400 hover:text-gray-900"
            )}
            aria-label="React"
            title="React"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleLike(); }}
            disabled={likeBusy}
          >
            {side === "work" ? (
              <CheckCircle2 size={18} strokeWidth={2.5} />
            ) : (
              <Heart size={18} strokeWidth={2.5} fill={liked ? "currentColor" : "none"} />
            )}
            React
          </button>
        </div>
      </div>
    </div>
  );
}
EOF
  echo "OK: wrote $ROWFILE"
fi

# 2) Patch SideFeed to use PostRowLite + patchPost()
FILEPATH="$SIDEFEED" node - <<'NODE'
const fs = require("fs");

const file = process.env.FILEPATH;
let s = fs.readFileSync(file, "utf8");

const MARK = "sd_607_postrowlite_applied";
if (s.includes(MARK)) {
  console.log("OK: SideFeed already patched (marker found).");
  process.exit(0);
}

let changed = false;

// Replace PostCard import with PostRowLite
{
  const re = /import\s+\{\s*PostCard\s*\}\s+from\s+"@\/src\/components\/PostCard";?/;
  if (re.test(s)) {
    s = s.replace(re, 'import { PostRowLite } from "@/src/components/PostRowLite";');
    changed = true;
    console.log("OK: swapped PostCard import -> PostRowLite");
  } else if (s.includes('from "@/src/components/PostRowLite"')) {
    console.log("OK: PostRowLite import already present");
  } else {
    console.log("WARN: could not find PostCard import to replace");
  }
}

// Update memoization
{
  const re = /const\s+MemoPostCard\s*=\s*React\.memo\(\s*PostCard\s*\);/;
  if (re.test(s)) {
    s = s.replace(re, "const MemoPostCard = React.memo(PostRowLite);");
    changed = true;
    console.log("OK: MemoPostCard now memoizes PostRowLite");
  } else if (s.includes("React.memo(PostRowLite)")) {
    console.log("OK: MemoPostCard already memoizes PostRowLite");
  } else {
    // best-effort: if PostCard not present but MemoPostCard exists
    const re2 = /const\s+MemoPostCard\s*=\s*React\.memo\(\s*([A-Za-z0-9_]+)\s*\);/;
    if (re2.test(s) && s.includes("PostRowLite")) {
      s = s.replace(re2, "const MemoPostCard = React.memo(PostRowLite);");
      changed = true;
      console.log("OK: normalized MemoPostCard -> PostRowLite");
    } else {
      console.log("WARN: could not update MemoPostCard line");
    }
  }
}

// Insert patchPost() helper (after openActionsFor if present, else after rawPosts state)
{
  if (!s.includes("sd_607_postrowlite: patch a post in-place")) {
    const block =
`\n\n  // sd_607_postrowlite: patch a post in-place (likes, etc) without full refresh\n  const patchPost = useCallback((id: string, patch: Partial<FeedItem>) => {\n    const pid = String(id || \"\");\n    if (!pid) return;\n    setRawPosts((prev) =>\n      prev.map((p) => (String((p as any)?.id || \"\") === pid ? ({ ...(p as any), ...(patch as any) } as any) : p))\n    );\n  }, []);\n`;

    const reOpenActionsFor = /const\s+openActionsFor\s*=\s*useCallback\([\s\S]*?\},\s*\[\s*\]\s*\);\n/;
    if (reOpenActionsFor.test(s)) {
      s = s.replace(reOpenActionsFor, (m) => m + block);
      changed = true;
      console.log("OK: inserted patchPost after openActionsFor");
    } else {
      const reRaw = /const\s*\[\s*rawPosts\s*,\s*setRawPosts\s*\]\s*=\s*useState<FeedItem\[\]?>\(\[\]\);\n/;
      if (reRaw.test(s)) {
        s = s.replace(reRaw, (m) => m + block);
        changed = true;
        console.log("OK: inserted patchPost after rawPosts state");
      } else {
        console.log("WARN: could not find insertion anchor for patchPost");
      }
    }
  } else {
    console.log("OK: patchPost already present");
  }
}

// Add onPatchPost={patchPost} to MemoPostCard row render
{
  if (!s.includes("onPatchPost={patchPost}")) {
    const re = /<MemoPostCard([\s\S]*?)\/>/g;
    let did = false;
    s = s.replace(re, (full) => {
      if (full.includes("onPatchPost=")) return full;
      if (!full.includes('variant="row"')) return full; // only touch feed rows
      did = true;
      return full.replace("/>", " onPatchPost={patchPost} />");
    });
    if (did) {
      changed = true;
      console.log("OK: wired MemoPostCard onPatchPost -> patchPost");
    } else {
      console.log("WARN: could not find MemoPostCard row element to patch");
    }
  } else {
    console.log("OK: onPatchPost already wired");
  }
}

if (changed) {
  s += `\n\n// ${MARK}\n`;
  fs.writeFileSync(file, s, "utf8");
  console.log("WROTE: SideFeed updated.");
} else {
  console.log("No changes made.");
}
NODE

echo ""
echo "✅ $NAME applied."
echo "Backup: $BK_DIR"
echo ""
echo "Next (VS Code terminal):"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Smoke:"
echo "  1) Open /siddes-feed and scroll — should be smoother."
echo "  2) Tap React — should update without a full refresh."
echo "  3) Tap More (…) — global actions sheet should open (sd_606)."
BASH
