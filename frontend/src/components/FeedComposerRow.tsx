"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Send } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES } from "@/src/lib/sides";
import { usePrismAvatar } from "@/src/hooks/usePrismAvatar";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type SubmitResult = { ok: boolean; message?: string };

/**
 * Siddes Standard (Mobile):
 * - The in-feed composer is a LAUNCHER, not the full editor.
 * - Tap opens /siddes-compose (audience lock + set/topic selection + clear Post CTA).
 *
 * Desktop:
 * - Keep quick-inline posting (fast keyboard workflow) + "+" for advanced composer.
 */
export function FeedComposerRow(props: {
  side: SideId;
  prompt: string;
  subtitle?: string;
  onOpen: () => void; // advanced composer (media / longer post)
  onSubmit: (text: string) => Promise<SubmitResult>; // quick inline post (desktop)
}) {
  const { side, prompt, subtitle, onOpen, onSubmit } = props;
  const theme = SIDE_THEMES[side];

  const { img: meImg, initials: meInitials } = usePrismAvatar(side);

  // Desktop quick composer state
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const canSubmit = text.trim().length > 0 && !busy;

  useEffect(() => {
    // Auto-resize textarea (desktop)
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(140, el.scrollHeight || 0);
    el.style.height = `${Math.max(44, next)}px`;
  }, [text]);

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await onSubmit(t);
      if (res?.ok) {
        setText("");
        setError(null);
        return;
      }
      setError(res?.message || "Couldn’t post — try again.");
    } catch {
      setError("Couldn’t post — try again.");
    } finally {
      setBusy(false);
    }
  };

  const openAtRef = useRef(0);

  const open = () => {
    const now = Date.now();
    if (now - openAtRef.current < 450) return;
    openAtRef.current = now;
    try {
      onOpen();
    } catch {
      // ignore
    }
  };

  return (
    <div className="px-4 py-4 bg-white border-b border-gray-100 lg:px-0 lg:py-6">
      <div className="w-full">
        <div className="flex items-start gap-4 lg:gap-6">
          {/* Your Prism avatar (per Side) */}
          <div
            className={cn(
              "w-11 h-11 lg:w-14 lg:h-14 rounded-full overflow-hidden border flex items-center justify-center text-[11px] font-black shrink-0 select-none",
              theme.border,
              meImg ? "bg-gray-100" : cn(theme.lightBg, theme.text)
            )}
            aria-hidden="true"
            title="You"
          >
            {meImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={meImg} alt="" className="w-full h-full object-cover" />
            ) : (
              meInitials
            )}
          </div>

          <div className="flex-1 min-w-0">
            {subtitle ? (
              <div className="text-[11px] text-gray-500 font-semibold mb-1 truncate">{subtitle}</div>
            ) : null}

            {/* Mobile: launcher (no keyboard on feed) */}
            <div className="lg:hidden">
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-3xl px-3 py-2.5">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    open();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    open();
                  }}
                  onClick={open}
                  className="flex-1 min-w-0 text-left py-2"
                  aria-label="Open composer"
                  title="Compose"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open();
                    }
                  }}
                >
                  <div className="text-[15px] leading-5 text-gray-500 truncate">{prompt}</div>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    open();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    open();
                  }}
                  onClick={open}
                  className="w-11 h-11 rounded-2xl border border-gray-200 bg-white text-gray-700 flex items-center justify-center active:scale-[0.98] transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20"
                  aria-label="Add media"
                  title="Add media"
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    open();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    open();
                  }}
                  onClick={open}
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center active:scale-[0.98] transition shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20",
                    cn(theme.primaryBg, "text-white")
                  )}
                  aria-label="Compose"
                  title="Compose"
                >
                  <Send size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Desktop: quick inline post */}
            <div className="hidden lg:block">
              <div className="flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-3xl px-3 py-2.5 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-white">
                <textarea
                  ref={taRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                onFocus={(e) => {
                  try {
                    const isDesktop =
                      typeof window !== "undefined" &&
                      (window as any).matchMedia &&
                      (window as any).matchMedia("(min-width: 1024px)").matches;

                    // Siddes Standard: on mobile, the feed composer is a LAUNCHER.
                    if (!isDesktop) {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        (e.target as any)?.blur?.();
                      } catch {}
                      onOpen();
                    }
                  } catch {}
                }}
                onTouchStart={(e) => {
                  try {
                    const isDesktop =
                      typeof window !== "undefined" &&
                      (window as any).matchMedia &&
                      (window as any).matchMedia("(min-width: 1024px)").matches;

                    if (!isDesktop) {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        (e.target as any)?.blur?.();
                      } catch {}
                      onOpen();
                    }
                  } catch {}
                }}
                  placeholder={prompt}
                  className="flex-1 min-w-0 resize-none bg-transparent outline-none text-[15px] leading-5 text-gray-900 placeholder:text-gray-500"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  aria-label="Write a post"
                />

                {/* Advanced */}
                <button
                  type="button"
                  onClick={open}
                  className="w-11 h-11 rounded-2xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center active:scale-[0.98] transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20"
                  aria-label="Open composer"
                  title="Add photo or more"
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>

                {/* Send */}
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                  aria-disabled={!canSubmit}
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center active:scale-[0.98] transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20",
                    canSubmit ? cn(theme.primaryBg, "text-white shadow-sm") : "bg-white border border-gray-200 text-gray-300 cursor-not-allowed"
                  )}
                  aria-label="Send"
                  title={canSubmit ? "Post" : "Write something"}
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2.5} />}
                </button>
              </div>

              {error ? (
                <div className="mt-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-2xl">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

