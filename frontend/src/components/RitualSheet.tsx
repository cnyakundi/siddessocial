"use client";

// sd_338: Ritual detail + respond sheet

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, HelpCircle, MessageCircle, Smile, Sparkles, X } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { RitualItem, RitualResponseItem } from "@/src/lib/ritualsTypes";
import { getRitualsProvider } from "@/src/lib/ritualsProvider";
import { toast } from "@/src/lib/toast";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function kindIcon(kind: string) {
  const k = String(kind || "").toLowerCase();
  if (k === "mood") return Smile;
  if (k === "reading") return BookOpen;
  if (k === "question") return HelpCircle;
  if (k === "townhall") return Sparkles;
  return MessageCircle;
}

function formatTimeAgo(ts: number): string {
  const now = Date.now() / 1000;
  const d = Math.max(0, now - ts);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

function formatCount(num: number): string {
  if (!Number.isFinite(num)) return "0";
  if (num < 1000) return String(num);
  const s = (num / 1000).toFixed(1);
  return (s.endsWith(".0") ? s.slice(0, -2) : s) + "k";
}

function summarizeResponse(r: RitualResponseItem): string {
  const t = String(r.text || "").trim();
  if (t) return t;
  const p = r.payload || {};
  const emoji = String((p as any).emoji || (p as any).mood || "").trim();
  const title = String((p as any).title || (p as any).name || "").trim();
  const url = String((p as any).url || "").trim();
  if (emoji) return emoji + (title ? ` ${title}` : "");
  if (title) return title;
  if (url) return url;
  return "(response)";
}

const MOOD_CHOICES: Array<{ emoji: string; label: string }> = [
  { emoji: "😄", label: "Great" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😩", label: "Tired" },
  { emoji: "😡", label: "Annoyed" },
];

export function RitualSheet({
  open,
  onClose,
  ritualId,
  mode = "view",
  initialRitual,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  ritualId: string | null;
  mode?: "view" | "reply";
  initialRitual?: RitualItem | null;
  onUpdated?: (r: RitualItem) => void;
}) {
  const provider = useMemo(() => getRitualsProvider(), []);
  const [ritual, setRitual] = useState<RitualItem | null>(initialRitual || null);
  const [items, setItems] = useState<RitualResponseItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);

  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [mood, setMood] = useState<string>("");
  const [readingTitle, setReadingTitle] = useState("");
  const [readingUrl, setReadingUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !ritualId) return;
    setLoadBusy(true);
    Promise.all([provider.get(ritualId), provider.responses(ritualId)])
      .then(([r, rs]) => {
        if (r) setRitual(r);
        setItems(rs);
      })
      .catch(() => {
        // ignore; callers will see empty
      })
      .finally(() => setLoadBusy(false));
  }, [open, ritualId, provider]);

  if (!open || !ritualId) return null;

  const side: SideId = ritual?.side || "public";
  const theme = SIDE_THEMES[side];
  const KindIcon = kindIcon(String(ritual?.kind || ""));

  const isTownhall = side === "public" && String(ritual?.kind || "").toLowerCase() === "townhall";
  const host = typeof (ritual?.data as any)?.host === "string" ? String((ritual?.data as any)?.host) : "";


  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center md:items-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-xl mt-0.5", theme.lightBg, theme.text)}>
              <KindIcon size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">{ritual?.title || "Ritual"}</h3>
              <div className="text-xs text-gray-500 mt-1">
                <span className={cn("font-bold", theme.text)}>{SIDES[side].label}</span>
                {ritual?.setId ? <span className="text-gray-300"> • </span> : null}
                {ritual?.setId ? <span className="font-semibold text-gray-700">Set</span> : null}
                <span className="text-gray-300"> • </span>
                <span className="font-medium">{formatCount(ritual?.replies || 0)} {isTownhall ? "answers" : "replies"}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className={cn("p-4 rounded-2xl border border-gray-200 bg-white", "border-l-4", theme.accentBorder)}>
          <div className="text-sm font-semibold text-gray-900">{ritual?.prompt}</div>
          {isTownhall && host ? (
            <div className="mt-2 text-xs text-gray-600">
              <span className="font-bold text-gray-900">Gavel:</span> {host}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{isTownhall ? "Town Hall" : "Pulse"}</span>
            <span className={cn("text-[10px] font-bold uppercase tracking-widest", theme.text)}>
              {String(ritual?.status || "").toUpperCase()}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{isTownhall ? "Recent answers" : "Recent replies"}</div>
          <div className="mt-2 max-h-52 overflow-auto space-y-2">
            {loadBusy ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : items.length ? (
              items.map((r) => {
                const name = String((r.byDisplay as any)?.name || (r.byDisplay as any)?.handle || r.by || "Someone");
                const summary = summarizeResponse(r);
                return (
                  <div key={r.id} className="p-3 rounded-2xl border border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-bold text-gray-800 truncate">{name}</div>
                      <div className="text-[10px] text-gray-400 font-semibold">{formatTimeAgo(r.createdAt)}</div>
                    </div>
                    <div className="mt-1 text-sm text-gray-800">{summary}</div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500">{isTownhall ? "No answers yet." : "No replies yet."}</div>
            )}
          </div>
        </div>

        {/* Reply */}
        <div className="mt-5 border-t border-gray-200 pt-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Your reply</div>

          {String(ritual?.kind || "").toLowerCase() === "mood" ? (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                {MOOD_CHOICES.map((m) => (
                  <button
                    key={m.emoji}
                    type="button"
                    onClick={() => setMood(m.emoji)}
                    className={cn(
                      "px-3 py-2 rounded-xl border text-sm font-extrabold inline-flex items-center gap-2",
                      mood === m.emoji ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                    )}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <span className="text-xs">{m.label}</span>
                  </button>
                ))}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note…"
                className="mt-3 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 ring-gray-900"
              />
            </>
          ) : String(ritual?.kind || "").toLowerCase() === "reading" ? (
            <>
              <input
                value={readingTitle}
                onChange={(e) => setReadingTitle(e.target.value)}
                placeholder="What are you reading? (title)"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 ring-gray-900"
              />
              <input
                value={readingUrl}
                onChange={(e) => setReadingUrl(e.target.value)}
                placeholder="Optional link"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 ring-gray-900"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note…"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 ring-gray-900"
              />
            </>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={side === "public" ? "Answer in one sentence…" : "Reply…"}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 ring-gray-900 min-h-[84px]"
            />
          )}

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!ritual) return;
              const kind = String(ritual.kind || "").toLowerCase();

              let payload: any = {};
              let t = "";

              if (kind === "mood") {
                if (!mood) {
                  toast.error("Pick a mood first.");
                  return;
                }
                payload = { emoji: mood, note: note.trim() };
              } else if (kind === "reading") {
                const title = readingTitle.trim();
                const url = readingUrl.trim();
                if (!title && !url) {
                  toast.error("Add a title or link.");
                  return;
                }
                payload = { title, url, note: note.trim() };
              } else {
                t = text.trim();
                if (!t) {
                  toast.error(side === "public" ? "Write an answer first." : "Write a reply first.");
                  return;
                }
              }

              setBusy(true);
              try {
                const updated = await provider.respond(ritual.id, { payload, text: t });
                if (updated) {
                  setRitual(updated);
                  onUpdated?.(updated);
                }
                const rs = await provider.responses(ritual.id).catch(() => []);
                setItems(rs);
                toast.success(side === "public" ? "Answer sent." : "Reply sent.");

                // reset inputs
                setText("");
                setNote("");
                setMood("");
                setReadingTitle("");
                setReadingUrl("");
              } catch (e: any) {
                toast.error(String(e?.message || "Could not send reply"));
              } finally {
                setBusy(false);
              }
            }}
            className={cn(
              "w-full mt-4 py-3 rounded-xl font-extrabold text-sm inline-flex items-center justify-center gap-2 transition",
              busy ? "bg-gray-200 text-gray-500" : cn(theme.primaryBg, "text-white hover:opacity-95")
            )}
          >
            <MessageCircle size={16} />
            {side === "public" ? "Answer" : "Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}
