"use client";


// sd_762_compact_other_sheets_max_height
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

import { Check, Plus, Settings2, X } from "lucide-react";
import type { CircleDef, CircleId } from "@/src/lib/circles";
import type { SideId } from "@/src/lib/sides";
import type { CircleColor } from "@/src/lib/circleThemes";
import { getCircleTheme } from "@/src/lib/circleThemes";
import { getCirclesProvider } from "@/src/lib/circlesProvider";
import { toast } from "@/src/lib/toast";
import { emitCirclesChanged } from "@/src/lib/circlesSignals";
import { getStubViewerCookie, isStubMe } from "@/src/lib/stubViewerClient";
import { normalizeHandle } from "@/src/lib/mentions";
import { getStoredRecentCircleIdsForSide, pushStoredRecentSetForSide, setStoredLastSetForSide } from "@/src/lib/audienceStore";
import { CreateCircleSheet } from "@/src/components/CreateCircleSheet";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function hashHue(seed: string): number {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function avatarInitial(handle: string): string {
  const s = String(handle || "").replace(/^@/, "").trim();
  if (!s) return "?";
  return s[0]!.toUpperCase();
}

function avatarStyle(seed: string): React.CSSProperties {
  const hue = hashHue(seed);
  // Stable, offline-safe: no external network calls.
  return { backgroundColor: `hsl(${hue} 70% 42%)` };
}

function MembersPreview({ members, inverted }: { members: string[]; inverted?: boolean }) {
  const list = Array.isArray(members) ? members.filter(Boolean) : [];
  if (!list.length) {
    return (
      <div className={cn("text-[11px] truncate", inverted ? "text-white/80" : "text-gray-500")}>
        No members yet
      </div>
    );
  }

  const shown = list.slice(0, 3);
  const more = Math.max(0, list.length - shown.length);

  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <div
            key={m}
            className={cn(
              "w-6 h-6 rounded-full border-2 overflow-hidden bg-gray-100 shadow-sm",
              inverted ? "border-white/40" : "border-white"
            )}
            title={m}
          >
            <div
              className="w-full h-full flex items-center justify-center text-[11px] font-black text-white select-none"
              style={avatarStyle(m)}
              aria-label={m}
            >
              {avatarInitial(m)}
            </div>
          </div>
        ))}
        {more > 0 ? (
          <div
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black",
              inverted ? "border-white/40 bg-white/10 text-white" : "border-white bg-gray-100 text-gray-600"
            )}
            title={`${more} more`}
          >
            +{more}
          </div>
        ) : null}
      </div>

      <div className={cn("text-[11px] truncate", inverted ? "text-white/80" : "text-gray-500")}>
        {list.length} people
      </div>
    </div>
  );
}

function parseMembers(raw: string): string[] {
  const parts = String(raw || "")
    .split(/[\n,]+/g)
    .map((s) => normalizeHandle(s))
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function CirclePickerSheet({
  open,
  onClose,
  sets,
  activeSet,
  onPick,
  onNewSet,
  title = "Circle",
  allLabel = "All",
  currentSide,
}: {
  open: boolean;
  onClose: () => void;
  sets: CircleDef[];
  activeSet: CircleId | null;
  onPick: (next: CircleId | null) => void;
  /** Optional escape hatch: manage sets on /siddes-circles (power-user). */
  onNewSet?: () => void;
  title?: string;
  allLabel?: string;
  currentSide: SideId;
}) {

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useLockBodyScroll(open && mounted);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open: open && mounted, containerRef: panelRef, initialFocusRef: closeBtnRef });

  const inferredSide: SideId = useMemo(() => {
    const byActive = activeSet ? sets.find((s) => s.id === activeSet) : null;
    return (byActive?.side || sets[0]?.side || "friends") as SideId;
  }, [sets, activeSet]);

  const contextSide: SideId = useMemo(() => {
    // Truth: the caller knows which Side is active.
    // If a Side has 0 sets yet, inferredSide falls back to friends — that was the bug.
    if (currentSide && currentSide !== "public") return currentSide;
    return inferredSide;
  }, [currentSide, inferredSide]);

  const viewer = getStubViewerCookie();
  const canWrite = !viewer || isStubMe(viewer);

  const recentSets = useMemo(() => {
    const ids = getStoredRecentCircleIdsForSide(contextSide, 3);
    const out: CircleDef[] = [];
    for (const id of ids) {
      const s = sets.find((x) => x.id === id);
      if (s && !out.find((y) => y.id === s.id)) out.push(s);
    }
    return out;
  }, [sets, contextSide]);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [membersRaw, setMembersRaw] = useState("");
  const [side, setSide] = useState<SideId>(contextSide);
  const [color, setColor] = useState<CircleColor>("emerald");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (createOpen) setCreateOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, createOpen]);

  useEffect(() => {
    if (!createOpen) return;
    // Default create sheet to current side.
    setSide(contextSide);
    setColor("emerald");
    setLabel("");
    setMembersRaw("");
    setCreateErr(null);
  }, [createOpen, contextSide]);

  const pick = (next: CircleId | null) => {
    try {
      setStoredLastSetForSide(contextSide, next);
      if (next) pushStoredRecentSetForSide(contextSide, next);
    } catch {}
    onPick(next);
    onClose();
  };

  const createNow = async (lab: string, raw: string, s: SideId, c?: CircleColor) => {
    setCreateErr(null);
    setCreating(true);
    try {
      const provider = getCirclesProvider();
      const members = parseMembers(raw);
      const created = await provider.create({ side: s, label: lab.trim(), members, color: c || color });
      toast("Circle created", { variant: "success" });
      try {
        emitCirclesChanged();
      } catch {}
      try {
        setStoredLastSetForSide(s, created.id);
        pushStoredRecentSetForSide(s, created.id);
      } catch {}
      onPick(created.id);
      onClose();
      return created;
    } catch (e: any) {
      const msg = e?.message || "Create failed.";
      setCreateErr(msg);
      toast(msg, { variant: "error" });
      throw e;
    } finally {
      setCreating(false);
    }
  };

  if (!open || !mounted) return null;

  return (
    <>
      <div className="fixed inset-0 z-[125] flex items-end justify-center md:items-center">
                <button
          type="button"
          aria-label="Close circle picker"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onPointerDown={(e) => {
            // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click/touch)
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          aria-labelledby="circle-picker-title"
          className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200 max-h-[70dvh] md:max-h-[80vh] overflow-y-auto overscroll-contain"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 id="circle-picker-title" className="text-lg font-bold text-gray-900">
                {title}
              </h3>
              <div className="text-[11px] text-gray-500 mt-1">Pick a circle. Create circles inline.</div>
            </div>
            <button
              type="button"
              ref={closeBtnRef}
              onClick={onClose}
              className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* New Circle (inline) */}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={cn(
              "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
              canWrite ? "border-gray-200 bg-white hover:bg-gray-50" : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
            )}
            disabled={!canWrite}
            aria-disabled={!canWrite}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                <Plus size={18} />
              </div>
              <div>
                <div className="font-black text-gray-900">New Circle</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Add people, then name</div>
              </div>
            </div>
            <div className="text-xs font-bold text-gray-500">{canWrite ? "Create" : "Read-only"}</div>
          </button>

          {/* Recents */}
          {recentSets.length ? (
            <div className="mt-4">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">Recent</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {recentSets.map((s) => {
                  const theme = getCircleTheme(s.color);
                  const isActive = activeSet === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pick(s.id)}
                      className={cn(
                        "px-3 py-2 rounded-full border text-xs font-black inline-flex items-center gap-2",
                        isActive ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                      )}
                      aria-label={`Recent group: ${s.label}`}
                    >
                      <span className={cn("w-2.5 h-2.5 rounded-full", isActive ? "bg-white" : theme.bg)} />
                      <span className="max-w-[10rem] truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* All + List */}
          <div className="space-y-2 mt-4">
            <button
              type="button"
              onClick={() => pick(null)}
              className={cn(
                "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                !activeSet ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn("w-2.5 h-2.5 rounded-full", !activeSet ? "bg-white" : "bg-gray-300")} />
                <div className="font-bold">{allLabel}</div>
              </div>
              {!activeSet ? <Check size={18} className="opacity-90" /> : null}
            </button>

            {sets.map((s) => {
              const theme = getCircleTheme(s.color);
              const isActive = activeSet === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                    isActive ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn("w-2.5 h-2.5 rounded-full", isActive ? "bg-white" : theme.bg)} />
                    <div className="min-w-0">
                      <div className={cn("font-bold truncate", isActive ? "text-white" : "text-gray-900")}>{s.label}</div>
                      <MembersPreview members={s.members} inverted={isActive} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.count > 0 ? (
                      <span
                        className={cn(
                          "text-[11px] px-2 py-1 rounded-full",
                          isActive ? "bg-white/15 text-white" : "bg-gray-100 text-gray-600 border border-gray-200"
                        )}
                      >
                        {s.count}
                      </span>
                    ) : null}
                    {isActive ? <Check size={18} className="opacity-90" /> : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Manage circles (optional) */}
          {onNewSet ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNewSet();
              }}
              className="w-full mt-5 py-3 rounded-xl font-bold text-sm border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center justify-center gap-2"
            >
              <Settings2 size={16} />
              Manage circles
            </button>
          ) : null}

          <button type="button" onClick={onClose} className="w-full mt-3 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
            Cancel
          </button>
        </div>
      </div>

      <CreateCircleSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        advanced={false}
        canWrite={canWrite}
        creating={creating}
        err={createErr}
        label={label}
        setLabel={setLabel}
        side={side}
        setSide={setSide}
        color={color}
        setColor={setColor}
        membersRaw={membersRaw}
        setMembersRaw={setMembersRaw}
        onCreate={createNow}
      />
    </>
  );
}
