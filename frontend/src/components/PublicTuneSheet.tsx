"use client";

import React, { useEffect } from "react";
import { Check, X } from "lucide-react";
import type { PublicChannelId } from "@/src/lib/publicChannels";
import { PUBLIC_CHANNELS } from "@/src/lib/publicChannels";
import type { PublicTrustMode } from "@/src/lib/publicTrustDial";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function PublicTuneSheet({
  open,
  onClose,
  showTopics,
  showTrust,
  showCounts,
  showMode,
  publicMode,
  onPublicMode,
  publicChannel,
  onPublicChannel,
  trustMode,
  onTrustMode,
  countsShown,
  onToggleCounts,
}: {
  open: boolean;
  onClose: () => void;
  showTopics: boolean;
  showTrust: boolean;
  showCounts: boolean;
  showMode?: boolean;
  publicMode?: "following" | "broadcasts";
  onPublicMode?: (m: "following" | "broadcasts") => void;
  publicChannel: "all" | PublicChannelId;
  onPublicChannel: (id: "all" | PublicChannelId) => void;
  trustMode: PublicTrustMode;
  onTrustMode: (m: PublicTrustMode) => void;
  countsShown: boolean;
  onToggleCounts: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasAnything = showTopics || showTrust || showCounts || !!showMode;

  return (
    <div className="fixed inset-0 z-[99] flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Close" />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-sm font-extrabold text-gray-900">Tune</div>
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {!hasAnything ? (
            <div className="text-sm text-gray-500">Nothing to tune yet.</div>
          ) : null}

          {showMode ? (
            <section>
              <div className="text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2">Feed</div>

              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "following", label: "Following", hint: "People you follow" },
                  { id: "broadcasts", label: "Broadcasts", hint: "Desks you follow" },
                ] as const).map((opt) => {
                  const current = publicMode || "following";
                  const active = current === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onPublicMode?.(opt.id)}
                      className={cn(
                        "px-3 py-2 rounded-2xl border text-left",
                        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <div className="text-sm font-extrabold flex items-center gap-2">
                        {active ? <Check size={16} /> : null}
                        {opt.label}
                      </div>
                      <div className={cn("text-xs mt-0.5", active ? "text-gray-200" : "text-gray-500")}>{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {showTopics ? (
            <section>
              <div className="text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2">Topics</div>

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onPublicChannel("all")}
                  className={cn(
                    "px-3 py-2 rounded-full text-sm font-bold border flex items-center gap-2",
                    publicChannel === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  {publicChannel === "all" ? <Check size={16} /> : null}
                  All Topics
                </button>

                {PUBLIC_CHANNELS.map((c) => {
                  const active = publicChannel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onPublicChannel(c.id)}
                      className={cn(
                        "px-3 py-2 rounded-full text-sm font-bold border flex items-center gap-2",
                        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      )}
                      title={c.desc}
                    >
                      {active ? <Check size={16} /> : null}
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {showTrust ? (
            <section>
              <div className="text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2">Trust Dial</div>

              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "calm", label: "Calm", hint: "trusted-only" },
                  { id: "standard", label: "Standard", hint: "balanced" },
                  { id: "arena", label: "Arena", hint: "everything" },
                ] as const).map((opt) => {
                  const active = trustMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onTrustMode(opt.id)}
                      className={cn(
                        "px-3 py-2 rounded-2xl border text-left",
                        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <div className="text-sm font-extrabold flex items-center gap-2">
                        {active ? <Check size={16} /> : null}
                        {opt.label}
                      </div>
                      <div className={cn("text-xs mt-0.5", active ? "text-gray-200" : "text-gray-500")}>{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {showCounts ? (
            <section>
              <div className="text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2">Visual Calm</div>

              <button
                type="button"
                onClick={onToggleCounts}
                className={cn(
                  "w-full px-4 py-3 rounded-2xl border flex items-center justify-between",
                  countsShown ? "bg-white text-gray-700 border-gray-200 hover:bg-gray-50" : "bg-gray-900 text-white border-gray-900 hover:opacity-90"
                )}
              >
                <div className="text-sm font-bold">Engagement counts</div>
                <div className={cn("text-sm font-extrabold", countsShown ? "text-gray-600" : "text-gray-100")}>
                  {countsShown ? "Shown" : "Hidden"}
                </div>
              </button>

              <div className="text-xs text-gray-500 mt-2">
                When hidden, likes/replies/echoes stay quiet until hover/tap. (Safer, calmer.)
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

