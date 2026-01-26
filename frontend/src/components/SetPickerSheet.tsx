"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

import { Check, Plus, Settings2, X } from "lucide-react";
import type { SetDef, SetId } from "@/src/lib/sets";
import type { SideId } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import { getSetTheme } from "@/src/lib/setThemes";
import { getSetsProvider } from "@/src/lib/setsProvider";
import { toast } from "@/src/lib/toast";
import { emitSetsChanged } from "@/src/lib/setsSignals";
import { getStubViewerCookie, isStubMe } from "@/src/lib/stubViewerClient";
import { normalizeHandle } from "@/src/lib/mentions";
import { getStoredRecentSetIdsForSide, pushStoredRecentSetForSide, setStoredLastSetForSide } from "@/src/lib/audienceStore";
import { CreateSetSheet } from "@/src/components/CreateSetSheet";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function avatarUrl(seed: string): string {
  const s = String(seed || "").replace(/^@/, "").trim() || "user";
  // Dicebear is fine for mocks; replace with real profile media later.
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s)}`;
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl(m)} alt={m} className="w-full h-full object-cover" />
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

export function SetPickerSheet({
  open,
  onClose,
  sets,
  activeSet,
  onPick,
  onNewSet,
  title = "Set",
  allLabel = "All",
}: {
  open: boolean;
  onClose: () => void;
  sets: SetDef[];
  activeSet: SetId | null;
  onPick: (next: SetId | null) => void;
  /** Optional escape hatch: manage sets on /siddes-sets (power-user). */
  onNewSet?: () => void;
  title?: string;
  allLabel?: string;
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

  const viewer = getStubViewerCookie();
  const canWrite = !viewer || isStubMe(viewer);

  const recentSets = useMemo(() => {
    const ids = getStoredRecentSetIdsForSide(inferredSide, 3);
    const out: SetDef[] = [];
    for (const id of ids) {
      const s = sets.find((x) => x.id === id);
      if (s && !out.find((y) => y.id === s.id)) out.push(s);
    }
    return out;
  }, [sets, inferredSide]);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [membersRaw, setMembersRaw] = useState("");
  const [side, setSide] = useState<SideId>(inferredSide);
  const [color, setColor] = useState<SetColor>("emerald");

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
    setSide(inferredSide);
    setColor("emerald");
    setLabel("");
    setMembersRaw("");
    setCreateErr(null);
  }, [createOpen, inferredSide]);

  const pick = (next: SetId | null) => {
    try {
      setStoredLastSetForSide(inferredSide, next);
      if (next) pushStoredRecentSetForSide(inferredSide, next);
    } catch {}
    onPick(next);
    onClose();
  };

  const createNow = async (lab: string, raw: string, s: SideId, c?: SetColor) => {
    setCreateErr(null);
    setCreating(true);
    try {
      const provider = getSetsProvider();
      const members = parseMembers(raw);
      const created = await provider.create({ side: s, label: lab.trim(), members, color: c || color });
      toast("Set created", { variant: "success" });
      try {
        emitSetsChanged();
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
          aria-label="Close set picker"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onPointerDown={(e) => {
            // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click)
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
          aria-labelledby="set-picker-title"
          className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200 max-h-[85dvh] md:max-h-[80vh] overflow-y-auto overscroll-contain"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 id="set-picker-title" className="text-lg font-bold text-gray-900">
                {title}
              </h3>
              <div className="text-[11px] text-gray-500 mt-1">Pick an audience. Create sets inline.</div>
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

          {/* New Set (inline) */}
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
                <div className="font-black text-gray-900">New Set</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Name + optional people</div>
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
                  const theme = getSetTheme(s.color);
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
                      aria-label={`Recent set: ${s.label}`}
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
              const theme = getSetTheme(s.color);
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

          {/* Manage sets (optional) */}
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
              Manage sets
            </button>
          ) : null}

          <button type="button" onClick={onClose} className="w-full mt-3 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
            Cancel
          </button>
        </div>
      </div>

      <CreateSetSheet
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
