"use client";

// sd_965_next_item_feed_row_clean

/* eslint-disable @next/next/no-img-element */

import React, { useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  Link as LinkIcon,
  MessageCircle,
  Repeat,
  Heart,
  CheckCircle2,
  MoreHorizontal,
  Megaphone,
  Share2,
  Copy,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import { FLAGS } from "@/src/lib/flags";
import type { FeedPost } from "@/src/lib/feedTypes";
import type { Chip } from "@/src/lib/chips";
import { buildChips, chipsFromPost } from "@/src/lib/chips";
import { ChipOverflowSheet } from "@/src/components/ChipOverflowSheet";
import { EchoSheet } from "@/src/components/EchoSheet";
import { QuoteEchoComposer } from "@/src/components/QuoteEchoComposer";
import { PostActionsSheet } from "@/src/components/PostActionsSheet";
import { EditPostSheet } from "@/src/components/EditPostSheet";
import { ProfilePeekSheet } from "@/src/components/ProfilePeekSheet";
import { toast } from "@/src/lib/toast";
import { saveReturnScroll } from "@/src/hooks/returnScroll";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { getSessionIdentity } from "@/src/lib/sessionIdentity";
import { makePostCacheKey, setCachedPost } from "@/src/lib/postInstantCache";
import { prefetchImages } from "@/src/lib/mediaPrefetch";

// Tailwind-safe hover text tokens (static strings)
const HOVER_TEXT: Record<SideId, string> = {
  public: "hover:text-blue-600",
  friends: "hover:text-emerald-600",
  close: "hover:text-rose-600",
  work: "hover:text-slate-700",
};

// 44x44 action hit targets + focus rings (mobile ergonomics)
const ACTION_BASE =
  "min-w-[44px] min-h-[44px] p-2 rounded-full inline-flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20 active:scale-[0.98]";

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

// sd_384_media: render attachments (R2 served via /m/* redirects)
type MediaItem = { id: string; url: string; kind: "image" | "video"; width?: number; height?: number; durationMs?: number };

function MediaViewerModal({
  open,
  items,
  index,
  ownerId,
  onClose,
  onIndexChange,
}: {
  open: boolean;
  items: MediaItem[];
  index: number;
  ownerId?: string;
  onClose: () => void;
  onIndexChange: React.Dispatch<React.SetStateAction<number>>;
}) {
  // iOS/PWA: portal so `position: fixed` isn't broken by transformed ancestors (virtualized feed rows).
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  useLockBodyScroll(open && mounted);

  const count = Array.isArray(items) ? items.length : 0;
  const safeIndex = Math.max(0, Math.min(count - 1, Math.floor(index || 0)));
  const active = items[safeIndex];

  const [muted, setMuted] = useState(true);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    // Reset to muted whenever the viewer opens or the active item changes.
    setMuted(true);
  }, [open, safeIndex]);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted, safeIndex, open]);

  const goPrev = React.useCallback(() => {
    if (count < 2) return;
    onIndexChange((prev) => (prev - 1 + count) % count);
  }, [count, onIndexChange]);

  const goNext = React.useCallback(() => {
    if (count < 2) return;
    onIndexChange((prev) => (prev + 1) % count);
  }, [count, onIndexChange]);

  // Preload adjacent images for instant Next/Prev.
  React.useEffect(() => {
    if (!open || count < 2) return;
    const preload = (m?: MediaItem) => {
      if (!m || m.kind !== "image") return;
      try {
        const img = new Image();
        img.src = m.url;
      } catch {}
    };
    preload(items[(safeIndex + 1) % count]);
    preload(items[(safeIndex - 1 + count) % count]);
  }, [open, safeIndex, count, items]);

  // Keep URL index in sync (deep-linkable media).
  React.useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const postId = String(ownerId || "");
    if (!postId) return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("sdm") != postId) return;
      u.searchParams.set("sdmi", String(safeIndex));
      window.history.replaceState(window.history.state, "", u.toString());
    } catch {}
  }, [open, safeIndex, ownerId]);

  // Tap-backdrop-to-close on touch (and keep swipe left/right).
  const touchRef = React.useRef<{ x: number; y: number; backdrop: boolean } | null>(null);

  React.useEffect(() => {
    if (!open || count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count, onClose, goPrev, goNext]);

  if (!open || !mounted || count === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        const t = e.touches?.[0];
        if (!t) return;
        touchRef.current = { x: t.clientX, y: t.clientY, backdrop: e.target === e.currentTarget };
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        const start = touchRef.current;
        touchRef.current = null;
        if (!start) return;

        const t = e.changedTouches?.[0];
        if (!t) return;

        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;

        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          dx > 0 ? goPrev() : goNext();
          return;
        }

        // Tap on the outer (dark) space closes.
        if (start.backdrop && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          onClose();
        }
      }}
    >
      {/* Close (safe-area aware) */}
      <button
        type="button"
        className="absolute z-[230] w-11 h-11 rounded-full bg-white/10 hover:bg-white/15 text-white inline-flex items-center justify-center transition-colors backdrop-blur"
        style={{
          top: "calc(env(safe-area-inset-top) + 12px)",
          left: "calc(env(safe-area-inset-left) + 12px)",
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        title="Close"
      >
        <X size={22} />
      </button>

      {/* Counter */}
      {count > 1 ? (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-white/70 text-sm font-semibold"
          style={{ top: "calc(env(safe-area-inset-top) + 18px)" }}
        >
          {safeIndex + 1} / {count}
        </div>
      ) : null}

      {/* Arrows */}
      {count > 1 ? (
        <>
          <button
            type="button"
            className="hidden md:inline-flex absolute left-3 top-1/2 -translate-y-1/2 z-[230] w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 text-white items-center justify-center transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goPrev();
            }}
            aria-label="Previous"
            title="Previous"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 z-[230] w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 text-white items-center justify-center transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goNext();
            }}
            aria-label="Next"
            title="Next"
          >
            <ChevronRight size={24} />
          </button>
        </>
      ) : null}

      {/* Media */}
      <div
        className="absolute inset-0 flex items-center justify-center px-4 py-16"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-[min(960px,calc(100vw-32px))] max-h-[calc(100dvh-120px)]">
          {active.kind === "video" ? (
            <div className="relative">
              <video
                ref={videoRef}
                className="max-w-full max-h-[calc(100dvh-120px)] bg-black"
                src={active.url}
                controls
                playsInline
                preload="metadata"
                muted={muted}
              />
              <button
                type="button"
                className="absolute bottom-4 right-4 z-[240] w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMuted((v) => !v);
                }}
                aria-label="Toggle mute"
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
          ) : (
            <img
              className="max-w-full max-h-[calc(100dvh-120px)] object-contain"
              src={active.url}
              alt=""
              draggable={false}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


function MediaGrid({ items, ownerId }: { items: MediaItem[]; ownerId: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const owner = String(ownerId || "");
  const pushedRef = React.useRef(false);

  const all = Array.isArray(items) ? items.filter((m) => Boolean(m?.url)) : [];
  const count = all.length;

  const readUrlIndex = React.useCallback((): number | null => {
    if (typeof window === "undefined") return null;
    if (!owner) return null;
    if (count <= 0) return null;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("sdm") !== owner) return null;
      const raw = u.searchParams.get("sdmi");
      const n = raw ? parseInt(raw, 10) : 0;
      const k = Number.isFinite(n) ? n : 0;
      return Math.max(0, Math.min(count - 1, k));
    } catch {
      return null;
    }
  }, [owner, count]);

  const pushUrl = React.useCallback(
    (i: number) => {
      if (typeof window === "undefined") return;
      if (!owner) return;
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("sdm", owner);
        u.searchParams.set("sdmi", String(i));
        window.history.pushState({ sd_media: 1 }, "", u.toString());
      } catch {}
    },
    [owner]
  );

  const requestClose = React.useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.get("sdm") === owner) {
          if (pushedRef.current) {
            // Close by popping the pushed URL state (Back button behavior).
            window.history.back();
            return;
          }
          // Deep-link/no-push case: just remove params in-place.
          u.searchParams.delete("sdm");
          u.searchParams.delete("sdmi");
          window.history.replaceState(window.history.state, "", u.toString());
        }
      } catch {}
    }
    pushedRef.current = false;
    setOpen(false);
  }, [owner]);

  // Open from URL state (deep-link / back-button).
  React.useEffect(() => {
    const idx = readUrlIndex();
    if (idx === null) return;
    if (open) return;
    setIndex(idx);
    setOpen(true);
    pushedRef.current = false;
  }, [readUrlIndex, open]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      const idx = readUrlIndex();
      if (idx === null) {
        setOpen(false);
        pushedRef.current = false;
        return;
      }
      setIndex(idx);
      setOpen(true);
      pushedRef.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [readUrlIndex]);

  const shown = all.slice(0, 4);
  const more = Math.max(0, count - shown.length);
  const isSingle = shown.length === 1;

  const openAt = (i: number) => {
    const safe = Math.max(0, Math.min(count - 1, i));
    setIndex(safe);
    setOpen(true);
    pushedRef.current = true;
    pushUrl(safe);
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      openAt(i);
    }
  };

  // sd_783_threads_exact_media_clean:
  // (marker) sd_783_threads_exact_media_clean
  // Threads/IG rule: the FIRST attachment defines the container aspect for a multi-attachment post.
  // We clamp to IG bounds so the row/grid always looks clean on desktop (like Threads web).
  const tileBase = "overflow-hidden rounded-2xl ring-1 ring-black/5 bg-gray-100";
  const tileGap = "gap-[6px]"; // tighter than gap-2

  // sd_904_media_prefetch: prefetch/decode images slightly ahead of viewport for smoother scroll.
  // (marker) sd_904_media_prefetch
  // Guardrails live in mediaPrefetch.ts (Save-Data/2G/offline/throttle).
  const prefetchOnceRef = React.useRef(false);
  const prefetchRootRef = React.useRef<HTMLDivElement | null>(null);

  const prefetchKey = (() => {
    try {
      const urls = shown
        .filter((m) => m && m.kind === "image" && Boolean(m.url))
        .map((m) => String(m.url))
        .slice(0, 2);
      return JSON.stringify(urls);
    } catch {
      return "[]";
    }
  })();

  const prefetchOnce = React.useCallback(() => {
    if (prefetchOnceRef.current) return;
    if (typeof window === "undefined") return;

    let urls: string[] = [];
    try {
      const parsed = JSON.parse(prefetchKey || "[]");
      urls = Array.isArray(parsed) ? parsed.map((u) => String(u || "")).filter(Boolean) : [];
    } catch {
      urls = [];
    }
    if (!urls.length) return;

    try {
      const queued = prefetchImages(urls, { decode: true });
      if (queued > 0) prefetchOnceRef.current = true;
    } catch {}
  }, [prefetchKey]);

  React.useEffect(() => {
    if (prefetchOnceRef.current) return;
    if (typeof window === "undefined") return;

    const el = prefetchRootRef.current;
    if (!el) return;

    const IO = (window as any).IntersectionObserver;
    if (!IO) {
      // Older browsers: best-effort prefetch immediately.
      prefetchOnce();
      return;
    }

    const obs = new IO(
      (entries: any[]) => {
        for (const e of entries) {
          if (e && e.isIntersecting) {
            prefetchOnce();
            try {
              obs.disconnect();
            } catch {}
            break;
          }
        }
      },
      { rootMargin: "900px 0px" }
    );

    obs.observe(el);
    return () => {
      try {
        obs.disconnect();
      } catch {}
    };
  }, [prefetchOnce]);

  // hook-safe: return after hooks
  if (count === 0) return null;

  const singleSize = (() => {
    const m = shown[0];
    const w = typeof (m as any)?.width === "number" ? Number((m as any).width) : 0;
    const h = typeof (m as any)?.height === "number" ? Number((m as any).height) : 0;
    const r = w > 0 && h > 0 ? w / h : 0;
    if (r && r < 0.8) return "h-[min(680px,72vh)]"; // portrait
    if (r && r > 1.35) return "h-[min(420px,55vh)]"; // wide
    return "h-[min(520px,65vh)]"; // default
  })();

  const tileAspect = (() => {
    const m = shown[0];
    const w = typeof (m as any)?.width === "number" ? Number((m as any).width) : 0;
    const h = typeof (m as any)?.height === "number" ? Number((m as any).height) : 0;
    const r0 = w > 0 && h > 0 ? w / h : 1;
    const r = Number.isFinite(r0) && r0 > 0 ? r0 : 1;
    const MIN = 0.8; // 4:5 portrait clamp
    const MAX = 1.91; // 1.91:1 landscape clamp
    return Math.max(MIN, Math.min(MAX, r));
  })();

  const gridCols = shown.length === 2 ? "grid-cols-2" : shown.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <>
      <div
        ref={prefetchRootRef}
        className={cn("w-full mb-3 lg:mb-4")}
        onMouseEnter={() => prefetchOnce()}
        onTouchStart={() => prefetchOnce()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {isSingle ? (
          <div
            className={cn(tileBase, "w-full cursor-zoom-in sm:max-w-[520px] sm:mx-auto")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => onKey(e, 0)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openAt(0);
            }}
            aria-label="Open media"
          >
            {shown[0].kind === "video" ? (
              <div className={cn("relative w-full bg-black", singleSize)}>
                <div className="absolute inset-0 bg-black" aria-hidden />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/35 flex items-center justify-center">
                    <Play size={26} className="text-white" />
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn("relative w-full bg-black", singleSize)}>
                <img
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  src={shown[0].url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </div>
            )}
          </div>
        ) : (
          <div className={cn("grid", tileGap, gridCols, "sm:max-w-[520px] sm:mx-auto")}>
            {shown.map((m, i) => (
              <div
                key={m.id || m.url}
                className={cn(tileBase, "relative cursor-zoom-in")}
                style={{ aspectRatio: tileAspect }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => onKey(e, i)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openAt(i);
                }}
                aria-label={m.kind === "video" ? "Open video" : "Open image"}
              >
                {m.kind === "video" ? (
                  <>
                    <video
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      src={m.url}
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 bg-black/10" aria-hidden />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-black/45 flex items-center justify-center">
                        <Play size={22} className="text-white" />
                      </div>
                    </div>
                    {typeof m.durationMs === "number" && m.durationMs > 0 ? (
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/55 text-white text-xs font-semibold">
                        {formatDurationMs(m.durationMs)}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <img
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    src={m.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                )}

                {more > 0 && i === shown.length - 1 ? (
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                    <div className="px-3 py-1.5 rounded-full bg-black/45 text-white text-sm font-extrabold">
                      +{more}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <MediaViewerModal
        open={open}
        items={all}
        index={index}
        ownerId={owner}
        onClose={requestClose}
        onIndexChange={setIndex}
      />
    </>
  );
}


// ---- Link preview helpers (no external fetch) ----
type LinkInfo = { href: string; domain: string; display: string };

function extractFirstUrl(text: string): string | null {
  const s = String(text || "");
  const m = s.match(/(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/i);
  if (!m) return null;

  let url = String(m[0] || "");

  // Trim punctuation that often sticks to URLs in prose.
  url = url.replace(/[)\],.!?:;]+$/g, "");

  if (url.startsWith("www.")) url = "https://" + url;
  return url;
}

function safeLinkInfo(raw: string): LinkInfo | null {
  const r = String(raw || "").trim();
  if (!r) return null;
  try {
    const u = new URL(r);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const domain = (u.hostname || "").replace(/^www\./i, "");
    let display = u.toString().replace(/^https?:\/\//i, "");
    if (display.length > 72) display = display.slice(0, 69) + "…";
    return { href: u.toString(), domain: domain || u.hostname, display };
  } catch {
    return null;
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  const t = String(text || "");
  if (!t) return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {}

  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

const AVATAR_STYLES = [
  // Non-Side palette (Chameleon law: Side colors are reserved for Side meaning)
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
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
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

function ContextStamp({ side, context, mode = "full" }: { side: SideId; context?: string | null; mode?: "full" | "context" }) {
  const theme = SIDE_THEMES[side];

  // sd_935_postcard_row_metadata_clean: row variant wants context-only (no redundant Side label)
  if (mode === "context") {
    if (!context) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border",
          theme.lightBg,
          theme.text,
          theme.border
        )}
        aria-label={context}
        title={context}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", theme.primaryBg)} aria-hidden="true" />
        <span className="font-semibold truncate max-w-[180px]">{context}</span>
      </span>
    );
  }

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

export function PostCard({
  post,
  side,
  onMore,
  calmHideCounts,
  variant = "card",
  avatarUrl,
}: {
  post: FeedPost;
  side: SideId;
  onMore?: (post: FeedPost) => void;
  calmHideCounts?: boolean;
  variant?: "card" | "row";
  showAccentBorder?: boolean;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // sd_717e_topic_tags: Side-bound topic tags (#) are local filing labels, not global discovery.
  const topicTags = useMemo(() => {
    const arr = (post as any)?.tags;
    if (!Array.isArray(arr)) return [] as string[];
    const internal = new Set(["urgent"]);
    const out: string[] = [];
    for (const raw of arr as any[]) {
      const t0 = String(raw || "").trim();
      if (!t0) continue;
      const t1 = (t0.startsWith("#") ? t0.slice(1) : t0).trim();
      if (!t1) continue;
      const t = t1.toLowerCase();
      if (internal.has(t)) continue;
      if (out.includes(t)) continue;
      out.push(t);
      if (out.length >= 8) break;
    }
    return out;
  }, [post]);

  const onTagClick = React.useCallback(
    (e: React.MouseEvent, tag: string) => {
      e.preventDefault();
      e.stopPropagation();
      const t = String(tag || "").trim();
      if (!t) return;
      try {
        // Preserve the scroll position so Back feels native.
        saveReturnScroll(post.id);

        // Side-bound topic tags are local filing labels.
        // For now we route to the feed with a filter hint (feed may ignore it until a dedicated view exists).
        router.push(`/siddes-feed?tag=${encodeURIComponent(t)}&side=${encodeURIComponent(side)}`);
      } catch {
        // ignore
      }
    },
    [post.id, router, side]
  );

  const isDetail = pathname.startsWith("/siddes-post/") || pathname.startsWith("/p/");

  // sd_568: prefetch post routes on intent (instant tap feel)
  const prefetchPost = () => {
    try {
      router.prefetch("/siddes-post/" + post.id);
      router.prefetch("/siddes-post/" + post.id + "?reply=1");
    } catch {}
  };

  const theme = SIDE_THEMES[side];
  const isRow = variant === "row";

  const hideCounts = Boolean(calmHideCounts);

  const showAccentBorder = !isRow && !isDetail;
  const allChips: Chip[] = useMemo(() => buildChips(chipsFromPost(post), { side }), [post, side]);

  // Context stamp uses Set OR Topic (mutually exclusive), always visible.
  const topicChip = allChips.find((c) => c.id === "topic") || null;
  const setChip = allChips.find((c) => c.id === "set") || null;
  const contextChip = side === "public" ? (topicChip || setChip) : setChip;

  // Keep chips for signals (Mention/Doc/Urgent), with overflow sheet.
  // sd_935_postcard_row_metadata_clean: keep feed rows calm; signals live behind +N.
  const signalChips = allChips.filter((c) => c.id !== "topic" && c.id !== "set");
  const visible = isRow ? [] : signalChips.slice(0, 1);
  const overflow = isRow ? signalChips : signalChips.slice(1);
  const overflowCount = overflow.length;

  const [openOverflow, setOpenOverflow] = useState(false);
  const [openEcho, setOpenEcho] = useState(false);
  const [openQuote, setOpenQuote] = useState(false);
  const [openActions, setOpenActions] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [contentOverride, setContentOverride] = useState<string | null>(null);
  const [editedAtMs, setEditedAtMs] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(() => isDetail);

  const displayContent = contentOverride ?? String((post as any)?.content ?? post.content ?? "");
  const isEdited = editedAtMs !== null || typeof (post as any)?.editedAt === "number";
  const rawText = String(displayContent || "");
  const linkInfo = useMemo(() => {
    const u = extractFirstUrl(rawText);
    return u ? safeLinkInfo(u) : null;
  }, [rawText]);

  // sd_384_media: attachments
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
        };
      })
      .filter((m) => Boolean(m.url));
  }, [post]);

  const hasText = rawText.trim().length > 0;
  const PREVIEW_LIMIT = side === "public" ? 360 : 520;
  const isLongText = hasText && rawText.trim().length > PREVIEW_LIMIT;
  const shownText = expanded || !isLongText ? rawText : rawText.slice(0, PREVIEW_LIMIT).trimEnd() + "…";
  const [hidden, setHidden] = useState(false);

  const replyCount = (() => {
    const n = Number((post as any)?.replyCount ?? 0);
    return Number.isFinite(n) ? n : 0;
  })();

  // Step 2.2: Echo + Quote Echo (real, DB-backed)
  const echoOf = ((post as any)?.echoOf ?? null) as any;
  const echoOfIdRaw = (() => {
    const v = echoOf?.id;
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    if (v == null) return "";
    return String(v);
  })();
  const echoOfId = echoOfIdRaw.trim();
  const echoOfIdOk = !!echoOfId && !/^(none|null|undefined|0)$/i.test(echoOfId);
  const isEchoPost = echoOfIdOk;
  const isQuoteEcho = isEchoPost && hasText;

  const [echoBusy, setEchoBusy] = useState(false);
  const [echoed, setEchoed] = useState<boolean>(() => Boolean((post as any)?.echoed));
  const [echoCount, setEchoCount] = useState<number>(() => {
    const n = Number((post as any)?.echoCount ?? 0);
    return Number.isFinite(n) ? n : 0;
  });

  // sd_180b: real Like toggle (optimistic, backed by /api/post/:id/like)
  // Final Polish (6): Chameleon sweep
  const [likeBusy, setLikeBusy] = useState(false);
  const [liked, setLiked] = useState<boolean>(() => Boolean((post as any)?.liked));
  const [likeCount, setLikeCount] = useState<number>(() => {
    const n = Number((post as any)?.likeCount ?? (post as any)?.likes ?? 0);
    return Number.isFinite(n) ? n : 0;
  });

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);

    const prevLiked = liked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;

    // Optimistic update
    setLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));

    try {
      const res = await fetch(`/api/post/${encodeURIComponent(post.id)}/like`, {
        method: nextLiked ? "POST" : "DELETE",
        cache: "no-store",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const err = j && typeof j.error === "string" && j.error ? j.error : "request_failed";
        throw new Error(err);
      }

      if (typeof j.liked === "boolean") setLiked(j.liked);
      if (typeof j.likeCount === "number") setLikeCount(j.likeCount);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      toast.error("Couldn't update like.");
    } finally {
      setLikeBusy(false);
    }
  };

  const toggleEcho = async () => {
    if (echoBusy) return;
    setEchoBusy(true);

    const prevEchoed = echoed;
    const prevCount = echoCount;
    const nextEchoed = !prevEchoed;

    // Optimistic update
    setEchoed(nextEchoed);
    setEchoCount((c) => Math.max(0, c + (nextEchoed ? 1 : -1)));

    try {
      // If this card is an echo/quote-echo, always target the *original* post.
      // This keeps echo/un-echo stable (backend uses client_key = echo:<post_id>:<side>).
      const targetId = isEchoPost ? echoOfId : String(post.id);
      const url = `/api/post/${encodeURIComponent(targetId)}/echo?side=${encodeURIComponent(side)}`;
      const res = await fetch(url, {
        method: nextEchoed ? "POST" : "DELETE",
        cache: "no-store",
        ...(nextEchoed
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ side }),
            }
          : {}),
      });

      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const err = j && typeof j.error === "string" && j.error ? j.error : "request_failed";
        throw new Error(err);
      }

      if (typeof j.echoed === "boolean") setEchoed(j.echoed);
      if (typeof j.echoCount === "number") setEchoCount(j.echoCount);

      toast.success(j.echoed ? "Echoed." : "Echo removed.");
      try {
        router.refresh();
      } catch {
        // ignore
      }
    } catch {
      setEchoed(prevEchoed);
      setEchoCount(prevCount);
      toast.error("Couldn't update echo.");
    } finally {
      setEchoBusy(false);
    }
  };

  const submitQuoteEcho = async (text: string): Promise<{ ok: boolean; message?: string }> => {
    const t = String(text || "").trim();
    if (!t) return { ok: false, message: "Write something first." };
    if (echoBusy) return { ok: false, message: "Still working — try again." };

    const maxLen = side === "public" ? 800 : 5000;
    if (t.length > maxLen) return { ok: false, message: `Too long. Max ${maxLen} characters.` };

    setEchoBusy(true);
    try {
      const targetId = isEchoPost ? echoOfId : String(post.id);
      const res = await fetch(`/api/post/${encodeURIComponent(targetId)}/quote`, {

        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t, side, client_key: `quote_${Date.now().toString(36)}` }),
      });
      const j = await res.json().catch(() => null);

      if (res.ok && j && j.ok === true) {
        toast.success("Quote Echoed.");
        // A quote echo is also an echo (state-wise) in this Side.
        setEchoed(true);
        setEchoCount((c) => c + 1);
        try {
          router.refresh();
        } catch {
          // ignore
        }
        return { ok: true };
      }

      const code = j && typeof j.error === "string" ? j.error : "request_failed";

      if (res.status === 400) {
        if (code === "too_long" && j && typeof j.max === "number") return { ok: false, message: `Too long. Max ${j.max} characters.` };
        if (code === "empty_text") return { ok: false, message: "Write something first." };
        return { ok: false, message: "Couldn’t quote echo — check your text." };
      }

      if (res.status === 401) return { ok: false, message: "Login required." };

      if (res.status === 403) {
        if (code === "echo_forbidden_private") return { ok: false, message: "Quote Echo is available for Public posts only." };
        if (code === "public_trust_low" && j && typeof j.min_trust === "number") return { ok: false, message: `Public quote echo requires Trust L${j.min_trust}+.` };
        if (code === "rate_limited" && j && typeof j.retry_after_ms === "number") {
          const sec = Math.max(1, Math.round(Number(j.retry_after_ms) / 1000));
          return { ok: false, message: `Slow down — try again in ${sec}s.` };
        }
        return { ok: false, message: "Restricted: you can’t quote echo here." };
      }

      if (res.status === 404) return { ok: false, message: "Post not found." };
      if (res.status >= 500) return { ok: false, message: "Server error — try again." };

      return { ok: false, message: "Couldn’t quote echo — try again." };
    } catch {
      return { ok: false, message: "Network error — try again." };
    } finally {
      setEchoBusy(false);
    }
  };

  // sd_736_fix_postcard_nav_share_restore: restore openPost/openProfile/openReply/doShare blocks (file was syntactically corrupted)
  const openPost = () => {
    if (isDetail) return;
    saveReturnScroll(post.id);
    try {
      const ident = getSessionIdentity();
      if (ident.authed && ident.viewerId && ident.epoch) {
        const key = makePostCacheKey({ epoch: String(ident.epoch), viewerId: String(ident.viewerId), postId: String(post.id) });
        setCachedPost(key, { post, side });
      }
    } catch {}
    router.push(`/siddes-post/${post.id}`);
  };

  // sd_480_profile_links: make profiles reachable from posts (avatar/name/handle)
  const openProfile = (handleOrName?: string) => {
    const raw = String(handleOrName || post.handle || post.author || "").trim();
    const u = raw.replace(/^@/, "").split(/\s+/)[0];
    if (!u) {
      toast.error("Profile not available.");
      return;
    }
    saveReturnScroll(post.id);
    router.push(`/u/${encodeURIComponent(u)}?side=${encodeURIComponent(side)}`);
  };

  // sd_920_profile_peek: long-press the author row to preview their profile without leaving the feed.
  const profilePeekUsername = useMemo(() => {
    const raw = String(post.handle || post.author || "").trim();
    const u = raw.replace(/^@/, "").split(/\s+/)[0];
    return u;
  }, [post.handle, post.author]);

  const [profilePeekOpen, setProfilePeekOpen] = useState(false);

  const profilePeekTimerRef = useRef<number | null>(null);
  const didProfilePeekRef = useRef(false);

  const startProfilePeek = () => {
    if (!profilePeekUsername) return;
    didProfilePeekRef.current = false;
    if (profilePeekTimerRef.current) window.clearTimeout(profilePeekTimerRef.current);
    profilePeekTimerRef.current = window.setTimeout(() => {
      didProfilePeekRef.current = true;
      setProfilePeekOpen(true);
    }, 500);
  };

  const endProfilePeek = () => {
    if (profilePeekTimerRef.current) {
      window.clearTimeout(profilePeekTimerRef.current);
      profilePeekTimerRef.current = null;
    }
  };

  const openProfileOrSwallowPeek = (handleOrName?: string) => {
    // If long-press fired, swallow the click to avoid double actions.
    if (didProfilePeekRef.current) {
      didProfilePeekRef.current = false;
      return;
    }
    openProfile(handleOrName);
  };


  const openReply = () => {
    saveReturnScroll(post.id);
    try {
      const ident = getSessionIdentity();
      if (ident.authed && ident.viewerId && ident.epoch) {
        const key = makePostCacheKey({ epoch: String(ident.epoch), viewerId: String(ident.viewerId), postId: String(post.id) });
        setCachedPost(key, { post, side });
      }
    } catch {}
    router.push(`/siddes-post/${post.id}?reply=1`);
  };

  const doEcho = async () => {
    setOpenEcho(false);
    await toggleEcho();
  };

  const doQuote = () => {
    setOpenEcho(false);
    setOpenQuote(true);
  };

  const doShare = async () => {
    setOpenEcho(false);
    const shareablePublic = side === "public" && (!post.setId || String(post.setId).startsWith("b_"));
    const relUrl = shareablePublic ? `/p/${post.id}` : `/siddes-post/${post.id}`;
    const absUrl = typeof window !== "undefined" ? `${window.location.origin}${relUrl}` : relUrl;

    // Context safety: only true Public posts (non-Set) support external share.
    if (!shareablePublic) {
      const ok = await copyToClipboard(absUrl);
      const msg = side === "public" ? "Internal link copied (Set requires access)." : "Internal link copied (requires access).";
      toast[ok ? "success" : "error"](ok ? msg : "Could not copy link.");
      return;
    }
    // Prefer the native share menu if available
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: "Siddes",
          text: (displayContent || "").slice(0, 140),
          url: absUrl,
        });
        toast.success("Shared.");
        return;
      }
    } catch {
      // fall through to copy link
    }

    // Fallback: copy link
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absUrl);
        toast.success("Link copied.");
        return;
      }
    } catch {
      // continue
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = absUrl;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not share link.");
    }
  };

  // Launch-safe: Echo is only offered on Public posts (prevents private re-broadcast leaks).
  const canEcho = side === "public";

  if (hidden) return null;

  return (
    <div
      className={cn(
        isRow
          ? "group py-4 border-b border-gray-100 hover:bg-gray-50/40 transition-colors"
          : cn(
              "bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100 transition-shadow hover:shadow-md",
              showAccentBorder ? "border-l-4" : "",
              showAccentBorder ? theme.accentBorder : ""
            )
      )}
      data-post-id={post.id}
    >
      {/* Header */}
      <div className={cn("flex justify-between items-start", isRow ? "mb-2" : "mb-4")}>
        <div onMouseEnter={prefetchPost} className="flex items-start gap-3 lg:gap-4 text-left">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openProfileOrSwallowPeek(post.handle || post.author);
            }}
            className="rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20"
            aria-label={"Open profile " + String(post.handle || post.author || "user")}
            title="View profile (hold to peek)"
              onMouseDown={startProfilePeek}
              onMouseUp={endProfilePeek}
              onMouseLeave={endProfilePeek}
              onTouchStart={startProfilePeek}
              onTouchEnd={endProfilePeek}
          >
            <Avatar name={post.author} handle={post.handle} avatarUrl={avatarUrl || post.authorAvatarUrl || null} />
          </button>
          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openProfileOrSwallowPeek(post.handle || post.author);
              }}
              className="flex items-center gap-2 min-w-0 text-left"
              aria-label={"Open profile " + String(post.handle || post.author || "user")}
              title="View profile (hold to peek)"
              onMouseDown={startProfilePeek}
              onMouseUp={endProfilePeek}
              onMouseLeave={endProfilePeek}
              onTouchStart={startProfilePeek}
              onTouchEnd={endProfilePeek}
            >
              <span className={cn("font-black text-gray-900 truncate hover:underline", isRow ? "text-[15px]" : "text-[15px] lg:text-[20px]")}>{post.author}</span>
              {!isRow ? <span className="text-gray-400 truncate hover:underline text-[12px] font-bold">{post.handle}</span> : null}
            </button>

            {/* Metadata row (time + stamp + chips) */}
            <div className="flex items-center gap-2 mt-1 flex-wrap min-w-0">
              <span className="text-xs text-gray-400">{post.time}</span>
              {isEdited ? (
                <>
                  <span className="text-gray-300 text-[10px]">•</span>
                  <span className="text-xs text-gray-400 font-semibold">Edited</span>
                </>
              ) : null}

              {(!isRow || contextChip?.label) ? (


                <>


                  <span className="text-gray-300 text-[10px]">•</span>


                  <ContextStamp side={side} context={contextChip?.label || null} mode={isRow ? "context" : "full"} />


                </>


              ) : null}

              {!isRow && visible.map((c) => (
                <span
                  key={c.id}
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1",
                    c.className
                  )}
                  aria-label={c.label}
                  title={c.label}
                >
                  <c.icon size={10} />
                  {c.label}
                </span>
              ))}

              {!isRow && overflowCount > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenOverflow(true);
                  }}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"
                  aria-label={`More context: ${overflowCount}`}
                  title="More"
                >
                  +{overflowCount}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            // sd_479_stopPropagation_more: prevent card click handlers / event bleed
            e.stopPropagation();
            e.preventDefault();
            onMore ? onMore(post) : setOpenActions(true);
          }}
          className={cn(
            "text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20",
            isRow ? (hideCounts ? "opacity-100" : "opacity-100") : "-mr-2"
          )}
          aria-label="Post options"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Body + Footer (indented under avatar) */}
      <div className="pl-[60px] lg:pl-[72px]">
        <div
          role="button"
          tabIndex={0}
          onMouseEnter={prefetchPost}
          onClick={(e) => {
            // sd_483_action_event_bleed: child actions may call preventDefault/stopPropagation
            if (e.defaultPrevented) return;
            // Selection-safe: don't navigate when the user is highlighting text.
            try {
              const sel = typeof window !== "undefined" ? window.getSelection() : null;
              if (sel && sel.toString().trim().length > 0) return;
            } catch {}
            openPost();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") openPost();
            if (e.key === " ") {
              e.preventDefault();
              openPost();
            }
          }}
          className="w-full text-left rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20"
          aria-label="Open thread"
        >
          {post.broadcast ? (
            <div className="flex items-center gap-2 mb-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
              <span
                className={cn(
                  "p-1 rounded-md", theme.lightBg, theme.text
                )}
              >
                <Megaphone size={12} />
              </span>
              <span>
                From{" "}
                <span className={cn("font-bold", theme.text)}>
                  {post.broadcast.name}
                </span>
              </span>
            </div>
          ) : null}

          {isEchoPost ? (
            <div className="flex items-center gap-2 mb-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
              <span className="p-1 bg-gray-50 rounded-md text-gray-700">
                <Repeat size={12} />
              </span>
              <span>{isQuoteEcho ? "Quote Echo" : "Echo"}</span>
            </div>
          ) : null}

          {!isEchoPost || isQuoteEcho || hasText ? (
            <p className={cn("text-gray-800 leading-relaxed whitespace-pre-wrap", isRow ? "text-[15px] mb-3" : "text-[15px] lg:text-[20px] mb-4")}>
              {shownText}
              {isLongText ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded((v) => !v);
                  }}
                  className={cn(
                    "ml-1 text-xs font-extrabold underline-offset-2 hover:underline",
                    theme.text
                  )}
                  aria-label={expanded ? "Show less" : "Read more"}
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              ) : null}
            </p>
          ) : null}

          {/* sd_717e_topic_tags: tag chips (subtle, folder-like) */}
          {topicTags.length ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {topicTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={(e) => onTagClick(e, t)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-full border font-extrabold tracking-wide",
                    theme.lightBg,
                    theme.text,
                    theme.border,
                    "hover:opacity-90"
                  )}
                  aria-label={`Filter by #${t}`}
                  title={`Filter by #${t}`}
                >
                  #{t}
                </button>
              ))}
            </div>
          ) : null}

          {isEchoPost && echoOf ? (
            <div className="w-full mb-3 p-3 rounded-2xl border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500 mb-1">Echoing</div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openProfile(echoOf.handle || echoOf.author);
                }}
                className="text-left w-full"
                aria-label={"Open profile " + String(echoOf.handle || echoOf.author || "user")}
                title="View profile (hold to peek)"
              onMouseDown={startProfilePeek}
              onMouseUp={endProfilePeek}
              onMouseLeave={endProfilePeek}
              onTouchStart={startProfilePeek}
              onTouchEnd={endProfilePeek}
              >
                <div className="text-sm font-semibold text-gray-900 hover:underline">{echoOf.author}</div>
                <div className="text-xs text-gray-400 hover:underline">{echoOf.handle}</div>
              </button>
              <div className="text-sm text-gray-700 mt-1">{echoOf.content || "(unavailable)"}</div>
            </div>
          ) : null}

          {mediaItems.length ? (
            <MediaGrid items={mediaItems} ownerId={post.id} />
          ) : null}

          {linkInfo ? (
            <div
              className="w-full rounded-3xl border-2 border-gray-100 bg-gray-50 mb-4 overflow-hidden"
              data-testid="post-link-preview"
            >
              <div className="flex items-stretch">
                <button
                  type="button"
                  className="flex-1 p-3 flex items-center gap-3 text-left hover:bg-gray-100/60 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      window.open(linkInfo.href, "_blank", "noopener,noreferrer");
                    } catch {
                      toast.error("Could not open link.");
                    }
                  }}
                  aria-label={"Open link " + linkInfo.domain}
                  title={linkInfo.href}
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                    <LinkIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{linkInfo.domain}</div>
                    <div className="text-xs text-gray-500 truncate">{linkInfo.display}</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="px-3 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const ok = await copyToClipboard(linkInfo.href);
                    ok ? toast.success("Link copied.") : toast.error("Could not copy link.");
                  }}
                  aria-label="Copy link"
                  title="Copy link"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer: actions (feed: Reply + React only; detail: full) */}
        {isRow ? (
          <div className="mt-3 pt-2 border-t border-gray-100 grid grid-cols-[1fr_auto] items-center gap-2">
            {/* Counts (secondary, readable) */}
            <div className="min-w-0 min-h-[18px] text-[11px] font-semibold text-gray-500 tabular-nums truncate">
              {!hideCounts && (replyCount || likeCount || (canEcho && echoCount)) ? (
                <span className="inline-flex items-center gap-1.5">
                  {replyCount ? (
                    <span>
                      {replyCount} {replyCount === 1 ? "reply" : "replies"}
                    </span>
                  ) : null}
                  {replyCount && (likeCount || (canEcho && echoCount)) ? <span className="text-gray-300">•</span> : null}
                  {likeCount ? (
                    <span>
                      {likeCount}{" "}
                      {side === "work"
                        ? likeCount === 1
                          ? "ack"
                          : "acks"
                        : likeCount === 1
                          ? "like"
                          : "likes"}
                    </span>
                  ) : null}
                  {likeCount && canEcho && echoCount ? <span className="text-gray-300">•</span> : null}
                  {canEcho && echoCount ? (
                    <span>
                      {echoCount} {echoCount === 1 ? "echo" : "echoes"}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>

            {/* Actions (primary, icon-only) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  ACTION_BASE,
                  "hover:bg-gray-50 disabled:opacity-60",
                  liked ? theme.text : "text-gray-400 hover:text-gray-700"
                )}
                aria-label={
                  side === "work"
                    ? likeCount
                      ? `Acknowledge (${likeCount})`
                      : "Acknowledge"
                    : likeCount
                      ? `Like (${likeCount})`
                      : "Like"
                }
                title={side === "work" ? "Acknowledge" : "Like"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleLike();
                }}
                disabled={likeBusy}
              >
                {side === "work" ? (
                  <CheckCircle2 size={18} strokeWidth={2.5} />
                ) : (
                  <Heart size={18} strokeWidth={2.5} fill={liked ? "currentColor" : "none"} />
                )}
              </button>

              <button
                type="button"
                className={cn(ACTION_BASE, "text-gray-400 hover:text-gray-700 hover:bg-gray-50")}
                aria-label={replyCount ? `Reply (${replyCount})` : "Reply"}
                title="Reply"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openReply();
                }}
              >
                <MessageCircle size={18} strokeWidth={2.5} />
              </button>

              {canEcho ? (
                <button
                  type="button"
                  className={cn(
                    ACTION_BASE,
                    "hover:bg-gray-50 disabled:opacity-60",
                    echoed ? theme.text : "text-gray-400 hover:text-gray-700"
                  )}
                  aria-label={echoCount ? (echoed ? `Un-echo (${echoCount})` : `Echo (${echoCount})`) : (echoed ? "Un-echo" : "Echo")}
                  title={echoed ? "Un-echo" : "Echo"}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleEcho();
                  }}
                  disabled={echoBusy}
                >
                  <Repeat size={18} strokeWidth={2.5} />
                </button>
              ) : null}

              <button
                type="button"
                className={cn(ACTION_BASE, "text-gray-400 hover:text-gray-700 hover:bg-gray-50")}
                aria-label="Share"
                title="Share"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void doShare();
                }}
              >
                <Share2 size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-6 border-t border-gray-100">
            <div className="flex items-center gap-5">
              <button
                type="button"
                className={cn(ACTION_BASE, "text-gray-500", HOVER_TEXT[side])}
                aria-label="Reply"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openReply();
                }}
                title="Reply"
              >
                <span className="inline-flex items-center gap-1">
                  <MessageCircle size={22} strokeWidth={2} />
                  {!hideCounts && replyCount ? (
                    <span className="text-[11px] font-extrabold tabular-nums text-gray-500">{replyCount} {replyCount === 1 ? "Reply" : "Replies"}</span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                className={cn(
                  ACTION_BASE,
                  "transition-colors disabled:opacity-60",
                  liked ? theme.text : cn("text-gray-400", side === "work" ? HOVER_TEXT[side] : "hover:text-red-500")
                )}
                aria-label={side === "work" ? "Acknowledge" : "Like"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleLike();
                }}
                disabled={likeBusy}
                title={side === "work" ? "Acknowledge" : "Like"}
              >
                <span className="inline-flex items-center gap-1">
                  {side === "work" ? (
                    <CheckCircle2 size={22} strokeWidth={2} />
                  ) : (
                    <Heart size={22} strokeWidth={2} fill={liked ? "currentColor" : "none"} />
                  )}
                  {!hideCounts && likeCount ? (
                    <span className="text-[11px] font-extrabold tabular-nums text-gray-500">{likeCount} {side === "work" ? (likeCount === 1 ? "Ack" : "Acks") : (likeCount === 1 ? "Like" : "Likes")}</span>
                  ) : null}
                </span>
              </button>
            </div>

            <button
              type="button"
              className={cn(ACTION_BASE, "text-gray-400 hover:text-gray-700 hover:bg-gray-50")}
              aria-label="More"
              title="More"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onMore) onMore(post);
                else setOpenActions(true);
              }}
            >
              <MoreHorizontal size={22} strokeWidth={2} />
            </button>
          </div>
        )}
</div>

      <ProfilePeekSheet
        open={profilePeekOpen}
        onClose={() => setProfilePeekOpen(false)}
        username={profilePeekUsername}
        side={side}
        onOpenProfile={() => {
          setProfilePeekOpen(false);
          if (profilePeekUsername) openProfile(profilePeekUsername);
        }}
      />

      <ChipOverflowSheet
        open={openOverflow}
        onClose={() => setOpenOverflow(false)}
        chips={overflow}
        title="More context"
      />

      {canEcho ? (
        <>
      <EchoSheet
        open={openEcho}
        onClose={() => setOpenEcho(false)}
        post={post}
        side={side}
        onEcho={doEcho}
        onQuoteEcho={doQuote}
        echoed={echoed}
        echoBusy={echoBusy}
      />

      <QuoteEchoComposer
        open={openQuote}
        onClose={() => setOpenQuote(false)}
        post={post}
        side={side}
        busy={echoBusy}
        onSubmit={submitQuoteEcho}
      />
        </>
      ) : null}

<EditPostSheet
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        postId={String(post.id)}
        initialText={displayContent}
        maxLen={side === "public" ? 800 : 5000}
        onSaved={(nextText, editedAt) => {
          setContentOverride(nextText);
          setEditedAtMs(typeof editedAt === "number" ? editedAt : Date.now());
          try {
            router.refresh();
          } catch {}
        }}
      />

      <PostActionsSheet
        open={openActions}
        onClose={() => setOpenActions(false)}
        post={post}
        side={side}
        onOpen={openPost}
        onEcho={canEcho ? () => setOpenEcho(true) : undefined}
        onHide={() => {
          const pid = String((post as any)?.id || "").trim();
          if (!pid) {
            toast.error("Could not hide.");
            return;
          }

          // Optimistic hide
          setHidden(true);

          (async () => {
            try {
              const res = await fetch("/api/hidden-posts", {
                method: "POST",
                cache: "no-store",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ postId: pid, hidden: true }),
              });
              const j = await res.json().catch(() => null);
              if (!res.ok || !j || j.ok !== true) throw new Error(String((j as any)?.error || "hide_failed"));
              try {
                router.refresh();
              } catch {}
            } catch {
              setHidden(false);
              toast.error("Could not hide.");
            }
          })();

          toast.undo("Post hidden.", () => {
            setHidden(false);
            (async () => {
              try {
                await fetch("/api/hidden-posts", {
                  method: "POST",
                  cache: "no-store",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ postId: pid, hidden: false }),
                });
              } catch {}
              try {
                router.refresh();
              } catch {}
            })();
          });
        }} /* sd_422_user_hide */
        onEdit={() => setOpenEdit(true)}
        onDelete={async () => {
          try {
            const res = await fetch(`/api/post/${encodeURIComponent(String(post.id))}`, { method: "DELETE", cache: "no-store" });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !j || j.ok !== true) throw new Error(String(j?.error || "delete_failed"));
            setHidden(true);
            toast.success("Post deleted.");
            try {
              const p = typeof window !== "undefined" ? window.location.pathname : "";
              if (p && p.startsWith("/siddes-post/")) {
                try {
                  router.replace("/siddes-feed");
                } catch {
                  // no hard reload fallback
                }
                return;
              }
            } catch {}
            try {
              router.refresh();
            } catch {}
          } catch {
            toast.error("Could not delete.");
          }
        }}
      />
    </div>
  );
}



// sd_813_fix_postcard_media_prefetch_hooks
