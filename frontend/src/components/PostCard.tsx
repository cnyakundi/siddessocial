"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  Link as LinkIcon,
  MessageCircle,
  Repeat,
  Heart,
  MoreHorizontal,
} from "lucide-react";
import { type SideId, SIDE_THEMES } from "@/src/lib/sides";
import { FLAGS } from "@/src/lib/flags";
import { type FeedPost } from "@/src/lib/mockFeed";
import { buildChips, chipsFromPost, type Chip } from "@/src/lib/chips";
import { ChipOverflowSheet } from "@/src/components/ChipOverflowSheet";
import { SignalsSheet } from "@/src/components/SignalsSheet";
import { EchoSheet } from "@/src/components/EchoSheet";
import { QuoteEchoComposer } from "@/src/components/QuoteEchoComposer";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function Avatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-gray-200 border border-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
      <span className="text-xs font-bold">U</span>
    </div>
  );
}

export function PostCard({
  post,
  side,
  onMore,
  calmHideCounts,
}: {
  post: FeedPost;
  side: SideId;
  onMore?: (post: FeedPost) => void;
  calmHideCounts?: boolean;
}) {
  const router = useRouter();
  const theme = SIDE_THEMES[side];

  const hideCounts = side === "public" && FLAGS.publicCalmUi && !!calmHideCounts;

  const allChips: Chip[] = useMemo(() => buildChips(chipsFromPost(post)), [post]);
  const visible = allChips.slice(0, 2);
  const overflow = allChips.slice(2);
  const overflowCount = overflow.length;

  const [openOverflow, setOpenOverflow] = useState(false);
  const [openSignals, setOpenSignals] = useState(false);
  const [openEcho, setOpenEcho] = useState(false);
  const [openQuote, setOpenQuote] = useState(false);

  const onChipClick = (chip: Chip) => {
    alert(`Chip: ${chip.label}`);
  };

  const signals = post.signals ?? 0;

  const doEcho = () => {
    setOpenEcho(false);
    alert("Echoed to your current Side (stub).");
  };

  const doQuote = () => {
    setOpenEcho(false);
    setOpenQuote(true);
  };

  const doShare = () => {
    setOpenEcho(false);
    alert("Share externally (stub). Later: Web Share API + deep link cards.");
  };

  return (
    <div
      className={cn(
        "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 border-l-2 mb-4 transition-shadow hover:shadow-md",
        theme.accentBorder
      )}
      data-post-id={post.id}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <button
          type="button"
          onClick={() => router.push(`/siddes-post/${post.id}`)}
          className="flex gap-3 text-left"
          aria-label="Open post"
        >
          <Avatar />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{post.author}</span>
              <span className="text-gray-400 text-sm">{post.handle}</span>
            </div>

            {/* Metadata row (time + chips) */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-gray-400 mr-1">{post.time}</span>

              {visible.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChipClick(c);
                  }}
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity",
                    c.className
                  )}
                  aria-label={c.label}
                >
                  <c.icon size={10} />
                  {c.label}
                </button>
              ))}

              {overflowCount > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenOverflow(true);
                  }}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"
                  aria-label={`More context: ${overflowCount}`}
                >
                  +{overflowCount}
                </button>
              ) : null}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onMore?.(post)}
          className="text-gray-400 hover:text-gray-600 p-2 -mr-2"
          aria-label="Post options"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="text-gray-900 text-[15px] leading-relaxed mb-3">{post.content}</div>

      {post.kind === "image" ? (
        <div className="w-full h-56 bg-gray-100 rounded-xl mb-3 flex items-center justify-center text-gray-400 overflow-hidden">
          <ImageIcon size={32} />
        </div>
      ) : null}

      {post.kind === "link" ? (
        <div className="w-full rounded-xl border border-gray-100 bg-gray-50 mb-3 p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-500">
            <LinkIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">Link preview</div>
            <div className="text-xs text-gray-500 truncate">Attached document or URL</div>
          </div>
        </div>
      ) : null}

      {/* Tags */}
      {post.tags?.length ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {post.tags.map((t) => (
            <button
              key={t}
              type="button"
              className="text-sm text-gray-500 font-medium hover:text-gray-800 hover:underline"
              onClick={() => console.log("tag", t)}
            >
              #{t}
            </button>
          ))}
        </div>
      ) : null}

      {/* Footer: Signals + actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <button
          type="button"
          onClick={() => setOpenSignals(true)}
          className={cn(
            "text-sm font-bold text-gray-900 hover:underline",
            hideCounts ? "group inline-flex items-center gap-1" : ""
          )}
          aria-label="Open signals"
        >
          {hideCounts ? (
            <>
              <span>Signals</span>
              <span className="tabular-nums text-gray-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 transition-opacity">
                ({signals})
              </span>
            </>
          ) : (
            <>
              {signals} Signals
            </>
          )}
        </button>

        <div className="flex gap-5">
          <button className="text-gray-400 hover:text-gray-700 transition-colors p-1" aria-label="Reply">
            <MessageCircle size={22} strokeWidth={1.5} />
          </button>
          <button
            className="text-gray-400 hover:text-gray-700 transition-colors p-1"
            aria-label="Echo"
            onClick={() => setOpenEcho(true)}
          >
            <Repeat size={22} strokeWidth={1.5} />
          </button>
          <button className="text-gray-400 hover:text-gray-700 transition-colors p-1" aria-label="Like">
            <Heart size={22} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <ChipOverflowSheet open={openOverflow} onClose={() => setOpenOverflow(false)} chips={overflow} title="More context" />
      <SignalsSheet open={openSignals} onClose={() => setOpenSignals(false)} totalSignals={signals} />

      <EchoSheet open={openEcho} onClose={() => setOpenEcho(false)} post={post} onEcho={doEcho} onQuoteEcho={doQuote} onShareExternal={doShare} />
      <QuoteEchoComposer open={openQuote} onClose={() => setOpenQuote(false)} post={post} onSubmit={(text) => { setOpenQuote(false); alert(`Quote Echoed (stub): ${text || "(no text)"}`); }} />
    </div>
  );
}
