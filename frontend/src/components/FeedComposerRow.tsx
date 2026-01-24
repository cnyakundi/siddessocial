"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Send } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type SubmitResult = { ok: boolean; message?: string };

export function FeedComposerRow(props: {
  side: SideId;
  prompt: string;
  subtitle?: string;
  onOpen: () => void; // advanced composer (media / longer post)
  onSubmit: (text: string) => Promise<SubmitResult>; // quick inline post
}) {
  const { side, prompt, subtitle, onOpen, onSubmit } = props;
  const theme = SIDE_THEMES[side];

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const canSubmit = text.trim().length > 0 && !busy;

  useEffect(() => {
    // Auto-resize textarea (calm, no jumping)
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(120, el.scrollHeight || 0);
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

  return (
    <div className="px-4 pt-3 pb-3 bg-white border-b border-gray-50 lg:px-0 lg:pt-6 lg:pb-4">
      <div className="max-w-[760px] mx-auto">
        <div className="flex items-end gap-2">
          {/* Avatar stub (future: real Prism avatar) */}
          <div
            className="w-10 h-10 rounded-full border border-gray-200 bg-gray-100 text-gray-700 flex items-center justify-center text-[11px] font-black shrink-0"
            aria-hidden="true"
            title="You"
          >
            ME
          </div>

          <div className="flex-1 min-w-0">
            {subtitle ? (
              <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1 truncate">{subtitle}</div>
            ) : null}

            <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-3xl px-3 py-2">
              <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", theme.primaryBg)} aria-hidden="true" />

              <textarea
                ref={taRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={prompt}
                className="flex-1 min-w-0 resize-none bg-transparent outline-none text-[15px] leading-5 text-gray-900 placeholder:text-gray-400"
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
                onClick={onOpen}
                className="w-10 h-10 rounded-2xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center active:scale-95 transition"
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
                  "w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition",
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
  );
}
