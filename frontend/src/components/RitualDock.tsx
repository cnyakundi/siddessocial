"use client";

// sd_338: Ritual Dock (Pulse) above the feed

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Flame, Globe, HelpCircle, Star, MessageCircle, Smile, Sparkles, Users, Briefcase } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { CircleId } from "@/src/lib/circles";
import type { RitualItem, RitualKind } from "@/src/lib/ritualsTypes";
import { getRitualsProvider } from "@/src/lib/ritualsProvider";
import { toast } from "@/src/lib/toast";
import { RitualCreateSheet } from "@/src/components/RitualCreateSheet";
import { RitualSheet } from "@/src/components/RitualSheet";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function sideIcon(side: SideId) {
  if (side === "public") return Globe;
  if (side === "friends") return Users;
  if (side === "close") return Star;
  return Briefcase;
}

function kindIcon(kind: string) {
  const k = String(kind || "").toLowerCase();
  if (k === "mood") return Smile;
  if (k === "reading") return BookOpen;
  if (k === "question") return HelpCircle;
  if (k === "townhall") return Sparkles;
  return MessageCircle;
}

function formatCount(num: number): string {
  if (!Number.isFinite(num)) return "0";
  if (num < 1000) return String(num);
  const s = (num / 1000).toFixed(1);
  return (s.endsWith(".0") ? s.slice(0, -2) : s) + "k";
}

function endsLabel(expiresAt: number | null): string | null {
  if (!expiresAt) return null;
  const now = Date.now() / 1000;
  const d = expiresAt - now;
  if (d <= 0) return "ended";
  if (d < 60) return "ends soon";
  if (d < 3600) return `ends in ${Math.round(d / 60)}m`;
  if (d < 86400) return `ends in ${Math.round(d / 3600)}h`;
  return "ends soon";
}

function RitualCard({
  ritual,
  onView,
  onReply,
  setLabel,
}: {
  ritual: RitualItem;
  onView: () => void;
  onReply: () => void;
  setLabel?: string;
}) {
  const theme = SIDE_THEMES[ritual.side];
  const isActive = String(ritual.status || "").toLowerCase() === "active";
  const isWarming = String(ritual.status || "").toLowerCase() === "warming";
  const SideIcon = sideIcon(ritual.side);
  const KindIcon = kindIcon(ritual.kind);
  const data: any = ritual.data || {};

  const topAnswers: string[] = Array.isArray(data.topAnswers) ? data.topAnswers.filter((x: any) => typeof x === "string") : [];
  const avatars: string[] = Array.isArray(data.avatars) ? data.avatars.filter((x: any) => typeof x === "string") : [];
  const vibe: string = typeof data.vibe === "string" ? data.vibe : "";

  const host: string = typeof data.host === "string" ? data.host : "";

  const progress = typeof data.progress === "number" ? data.progress : ritual.igniteThreshold > 0 ? Math.round((ritual.ignites / Math.max(1, ritual.igniteThreshold)) * 100) : 0;
  const igniteLabel = typeof data.label === "string" ? data.label : ritual.igniteThreshold > 0 ? `${ritual.ignites}/${ritual.igniteThreshold} ignites` : "";

  const timer = endsLabel(ritual.expiresAt);

  const primaryLabel = ritual.side === "public" ? "Answer" : isWarming ? "Reply to Ignite" : "Reply";

  return (
    <div
      className={cn(
        "relative p-4 rounded-2xl border transition-all overflow-hidden",
        isActive ? "bg-white border-gray-200 shadow-sm" : "bg-gray-50 border-dashed border-gray-300"
      )}
    >
      <div className={cn("absolute top-0 bottom-0 left-0 w-1", theme.primaryBg)} aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("p-2 rounded-xl mt-0.5", isActive ? theme.lightBg : "bg-gray-200", isActive ? theme.text : "text-gray-500")}>
            <KindIcon size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-gray-900 truncate">{ritual.title || "Ritual"}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-gray-500">
              <SideIcon size={10} className={theme.text} />
              <span className={cn("font-extrabold uppercase tracking-wider", theme.text)}>
                {SIDES[ritual.side].label}
              </span>
              {ritual.setId ? <span className="text-gray-300">•</span> : null}
              {ritual.setId ? <span className="truncate">{setLabel || "Set"}</span> : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1.5",
            isActive ? cn(theme.lightBg, theme.text, "border border-transparent") : cn("bg-transparent border border-dashed", theme.border, theme.text, "opacity-80")
          )}
        >
          <div className={cn("w-1.5 h-1.5 rounded-full", theme.primaryBg, isActive ? "animate-pulse" : "opacity-60")} />
          {ritual.side === "public" && String(ritual.kind || "").toLowerCase() === "townhall" ? "Today" : isActive ? "Active" : "Warming"}
        </div>
      </div>

      <div className="mt-3 text-sm font-medium text-gray-800">{ritual.prompt}</div>

      {/* Summary */}
      <div className={cn("mt-3 pl-3 border-l-2", theme.border)}>
        {String(ritual.kind || "").toLowerCase() === "mood" ? (
          <div className="space-y-2">
            <div className="text-xs text-gray-600">
              <span className="font-extrabold text-gray-900">Vibe:</span> {vibe || "—"}
            </div>
            <div className="flex -space-x-1.5">
              {avatars.slice(0, 3).map((name, i) => (
                <div key={i} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[9px] text-gray-600 font-black overflow-hidden">
                  {(name || "?")[0]}
                </div>
              ))}
              <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] text-gray-600 font-black">
                +{Math.max(0, (ritual.replies || 0) - Math.min(3, avatars.length))}
              </div>
            </div>
          </div>
        ) : String(ritual.kind || "").toLowerCase() === "reading" ? (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className={cn(theme.primaryBg, "h-full rounded-full opacity-80 transition-all duration-700")} style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
              <span className={cn(theme.text, "font-extrabold")}>{igniteLabel || "—"}</span>
              <span>{isWarming ? "needs support" : "active"}</span>
            </div>
          </div>
        ) : String(ritual.kind || "").toLowerCase() === "townhall" ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[9px] text-gray-700 font-black overflow-hidden">
              {(host || "T")[0]}
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-extrabold text-gray-900">Gavel:</span> {host || "Host"}
            </div>
            <span className="text-gray-300">•</span>
            <span className={cn("text-xs font-extrabold", theme.text)}>{formatCount(ritual.replies)} answers</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Top replies</div>
            <div className="flex flex-wrap gap-2">
              {(topAnswers.length ? topAnswers : []).slice(0, 3).map((t, i) => (
                <span key={i} className={cn("px-2 py-1 rounded-md text-xs font-bold border", theme.border, theme.lightBg, theme.text)}>
                  {t}
                </span>
              ))}
              {ritual.side === "public" ? (
                <span className="px-2 py-1 rounded-md text-xs font-bold border border-gray-200 bg-white text-gray-700">
                  {formatCount(ritual.replies)} answers
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-[10px] text-gray-400 font-semibold">{timer || ""}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onView}
            className="px-3 py-1.5 text-xs font-extrabold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          >
            View
          </button>
          <button
            type="button"
            onClick={onReply}
            className={cn(
              "px-4 py-1.5 text-xs font-extrabold shadow-sm active:scale-95 transition-all rounded-lg inline-flex items-center gap-1.5",
              isWarming ? cn("bg-white border", theme.border, theme.text) : cn(theme.primaryBg, "text-white")
            )}
          >
            {isWarming ? <Flame size={14} /> : <MessageCircle size={14} className={ritual.side === "public" ? "" : ""} />}
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyDock({
  side,
  hasSet,
  onOpenSetPicker,
  onStart,
}: {
  side: SideId;
  hasSet: boolean;
  onOpenSetPicker?: () => void;
  onStart: (k: RitualKind) => void;
}) {
  const theme = SIDE_THEMES[side];

  if (side !== "public" && !hasSet) {
    return (
      <div className="p-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50">
        <div className="text-sm font-bold text-gray-900">Pulse lives in Sets</div>
        <div className="text-xs text-gray-500 mt-1">Choose a Circle to see and start rituals.</div>
        <button
          type="button"
          onClick={() => onOpenSetPicker?.()}
          className={cn("mt-3 px-4 py-2 rounded-full text-sm font-extrabold", theme.primaryBg, "text-white hover:opacity-95")}
        >
          Choose Set
        </button>
      </div>
    );
  }

  if (side === "public") {
    return (
      <div className="p-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50">
        <div className="text-sm font-bold text-gray-900">No Town Hall right now</div>
        <div className="text-xs text-gray-500 mt-1">Public Rituals are curated (Gavel).</div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50">
      <div className="text-sm font-bold text-gray-900">Pulse is quiet</div>
      <div className="text-xs text-gray-500 mt-1">Start a ritual to check in with your people.</div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onStart("mood")} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-gray-700 hover:bg-gray-50">Mood</button>
        <button type="button" onClick={() => onStart("reading")} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-gray-700 hover:bg-gray-50">Reading</button>
        <button type="button" onClick={() => onStart("question")} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-gray-700 hover:bg-gray-50">Question</button>
      </div>
    </div>
  );
}

export function RitualDock({
  side,
  activeSet,
  activeSetLabel,
  onOpenSetPicker,
}: {
  side: SideId;
  activeSet: CircleId | null;
  activeSetLabel: string;
  onOpenSetPicker?: () => void;
}) {
  const provider = useMemo(() => getRitualsProvider(), []);
  const [restricted, setRestricted] = useState(false);
  const [items, setItems] = useState<RitualItem[]>([]);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<RitualKind>("mood");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"view" | "reply">("view");
  const [sheetRitual, setSheetRitual] = useState<RitualItem | null>(null);

  const reload = async () => {
    if (side !== "public" && !activeSet) {
      setItems([]);
      setRestricted(false);
      return;
    }

    setBusy(true);
    try {
      const out = await provider.dock({ side, setId: activeSet });
      setRestricted(out.restricted);
      setItems(out.items || []);
    } catch (e: any) {
      setItems([]);
      setRestricted(false);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, activeSet]);

  if (restricted) return null;

  return (
    <div className="p-4 border-b border-gray-100" data-testid="ritual-dock">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">Pulse</div>
        {side !== "public" && activeSet ? (
          <button
            type="button"
            onClick={() => {
              setCreateKind("mood");
              setCreateOpen(true);
            }}
            className="text-xs font-extrabold text-gray-700 hover:text-gray-900"
          >
            Start
          </button>
        ) : null}
      </div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((r) => (
            <RitualCard
              key={r.id}
              ritual={r}
              setLabel={activeSetLabel}
              onView={() => {
                setSheetRitual(r);
                setSheetMode("view");
                setSheetOpen(true);
              }}
              onReply={() => {
                setSheetRitual(r);
                setSheetMode("reply");
                setSheetOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyDock
          side={side}
          hasSet={Boolean(activeSet) || side === "public"}
          onOpenSetPicker={onOpenSetPicker}
          onStart={(k) => {
            if (!activeSet) {
              toast.error("Pick a Circle first.");
              onOpenSetPicker?.();
              return;
            }
            setCreateKind(k);
            setCreateOpen(true);
          }}
        />
      )}

      <RitualCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        side={side}
        setId={activeSet}
        setLabel={activeSetLabel}
        initialKind={createKind}
        onCreated={(r) => {
          // after create, refresh dock
          void reload();
        }}
      />

      <RitualSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ritualId={sheetRitual ? sheetRitual.id : null}
        mode={sheetMode}
        initialRitual={sheetRitual}
        onUpdated={() => {
          void reload();
        }}
      />

      {busy ? <div className="mt-2 text-[11px] text-gray-400">Updating…</div> : null}
    </div>
  );
}
