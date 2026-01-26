"use client";


// sd_764_fix_icon_tap_targets_44px
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { Check, Pencil, X } from "lucide-react";
import type { SuggestedSet } from "@/src/lib/setSuggestions";
import type { SetColor } from "@/src/lib/setThemes";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDE_THEMES, SIDES } from "@/src/lib/sides";
import { SET_THEMES } from "@/src/lib/setThemes";
import { sdTelemetry } from "@/src/lib/telemetry/sdTelemetry";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function colorForSide(side: SideId): SetColor {
  if (side === "public") return "blue";
  if (side === "close") return "rose";
  if (side === "work") return "slate";
  return "emerald";
}

type Override = {
  label?: string;
  side?: SideId;
  color?: SetColor;
  removed?: Record<string, true>; // handle -> removed
};

function isPersonalSuggestion(s: SuggestedSet): boolean {
  const id = String((s as any).id || "");
  if (id.startsWith("local_")) return true;
  const r = String((s as any).reason || "").toLowerCase();
  if (r.includes("contacts")) return true;
  if (r.includes("match")) return true;
  return false;
}

function effectiveSuggestion(base: SuggestedSet, o: Override | undefined): SuggestedSet {
  const label = (o?.label ?? base.label) as string;
  const side = (o?.side ?? (base as any).side ?? "friends") as SideId;
  const color = (o?.color ?? (base as any).color ?? colorForSide(side)) as SetColor;

  const removed = o?.removed ?? {};
  const members = (Array.isArray((base as any).members) ? (base as any).members : [])
    .filter((h: any) => typeof h === "string" && !removed[h])
    .map((h: string) => h.trim())
    .filter(Boolean);

  return { ...(base as any), label, side, color, members } as any;
}

export function SuggestedSetsSheet({
  open,
  onClose,
  suggestions,
  onAccept,
  onSkip,
  onAcceptMany,
  onSkipMany,
}: {
  open: boolean;
  onClose: () => void;
  suggestions: SuggestedSet[];
  onAccept: (s: SuggestedSet) => void;
  onSkip: (id: string) => void;
  onAcceptMany?: (suggestions: SuggestedSet[]) => void | Promise<void>;
  onSkipMany?: (ids: string[]) => void | Promise<void>;
}) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchNote, setBatchNote] = useState<string | null>(null);

  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  const validCount = useMemo(() => {
    return suggestions
      .map((s) => effectiveSuggestion(s, overrides[s.id]))
      .filter((s) => Array.isArray((s as any).members) && (s as any).members.length >= 2).length;
  }, [suggestions, overrides]);

  useEffect(() => {
    if (open && suggestions.length) sdTelemetry("suggestion_shown", suggestions.length);
  }, [open, suggestions.length]);

  async function acceptAll() {
    if (batchBusy) return;
    setBatchNote(null);
    setBatchBusy(true);
    try {
      const effAll = suggestions.map((s) => effectiveSuggestion(s, overrides[s.id]));
      const valid = effAll.filter((s) => Array.isArray((s as any).members) && (s as any).members.length >= 2);
      const skipped = effAll.length - valid.length;

      if (valid.length === 0) {
        setBatchNote("Nothing to accept yet. Each Set needs at least 2 members.");
        return;
      }

      sdTelemetry("suggestion_accepted", valid.length);
      if (skipped > 0) sdTelemetry("suggestion_skipped", skipped);

      if (onAcceptMany) {
        await onAcceptMany(valid);
      } else {
        valid.forEach((x) => onAccept(x));
      }

      if (skipped > 0) {
        setBatchNote(`${skipped} suggestion(s) skipped because they have fewer than 2 members.`);
      }
    } finally {
      setBatchBusy(false);
    }
  }

  async function skipAll() {
    if (batchBusy) return;
    setBatchNote(null);
    setBatchBusy(true);
    try {
      sdTelemetry("suggestion_skipped", suggestions.length);
      const ids = suggestions.map((x) => x.id);
      if (onSkipMany) {
        await onSkipMany(ids);
      } else {
        ids.forEach((id) => onSkip(id));
      }
    } finally {
      setBatchBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onPointerDown={(e) => {
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
      }} aria-label="Close" />
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="suggested-sets-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-4">
          <div id="suggested-sets-title" className="text-lg font-bold text-gray-900">Suggested Sets</div>
          <button className="p-2 rounded-full hover:bg-gray-100" onClick={onClose} aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          Based on your matches, you may want these Sets. <b>You are always in control.</b>
          <div className="text-xs text-gray-400 mt-1">
            Tip: remove anyone who does not belong before you Accept. Contacts-based Sets cannot be Public.
          </div>
        </div>

        {suggestions.length > 1 ? (
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={batchBusy || validCount === 0}
                onClick={acceptAll}
                className="px-4 py-2 rounded-full bg-gray-900 text-white text-xs font-extrabold hover:opacity-90 disabled:opacity-60"
              >
                {batchBusy ? "Accepting..." : `Accept valid (${validCount})`}
              </button>
              <button
                type="button"
                disabled={batchBusy}
                onClick={skipAll}
                className="px-4 py-2 rounded-full bg-gray-100 text-gray-800 text-xs font-extrabold hover:bg-gray-200 disabled:opacity-60"
              >
                Skip all
              </button>
            </div>
            {batchNote ? <div className="text-xs text-gray-500">{batchNote}</div> : null}
          </div>
        ) : null}

        <div className="space-y-3">
          {suggestions.map((base) => {
            const o = overrides[base.id];
            const s = effectiveSuggestion(base, o);
            const t = SET_THEMES[s.color] ?? SET_THEMES.orange;
            const members: string[] = Array.isArray((s as any).members) ? (s as any).members : [];
            const canAccept = members.length >= 2;
            const personal = isPersonalSuggestion(base);

            return (
              <div key={base.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className={cn("inline-flex items-center gap-2 px-2 py-1 rounded-full border text-xs font-bold", t.bg, t.text, t.border)}>
                      {s.label}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {SIDE_ORDER.map((sid) => {
                        const st = SIDE_THEMES[sid];
                        const selected = (s as any).side === sid;

                        const disabled = personal && sid === "public";
                        const classes = disabled
                          ? "bg-white text-gray-400 border-gray-200 cursor-not-allowed"
                          : (selected
                              ? `${st.lightBg} ${st.text} ${st.border} ring-2 ring-offset-2 ${st.ring}`
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50");

                        return (
                          <button
                            key={sid}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (disabled) return;
                              setOverrides((prev) => ({
                                ...prev,
                                [base.id]: {
                                  ...(prev[base.id] || {}),
                                  side: sid,
                                  color: colorForSide(sid),
                                },
                              }));
                            }}
                            className={"px-2 py-1 rounded-full border text-[11px] font-extrabold " + classes}
                            aria-label={`Set side to ${SIDES[sid].label}`}
                            title={
                              disabled
                                ? "Public is for Topics. Contacts-derived Sets must be private."
                                : `Side: ${SIDES[sid].label}`
                            }
                          >
                            {SIDES[sid].label}
                          </button>
                        );
                      })}
                    </div>

                    {personal ? (
                      <div className="text-[11px] text-gray-500 mt-2">Guardrail: contacts-derived Sets are never Public.</div>
                    ) : null}

                    <div className="text-xs text-gray-500 mt-2">{(base as any).reason}</div>

                    <div className="mt-2">
                      <div className="text-xs font-bold text-gray-500 mb-2">Members</div>
                      <div className="flex flex-wrap gap-2">
                        {((Array.isArray((s as any).members) ? (s as any).members : []).slice(0, 12)).map((h: string) => (
                          <span key={h} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-xs text-gray-700">
                            <span className="truncate max-w-[160px]">{h}</span>
                            <button
                              type="button"
                              className="p-2 -m-1 rounded-full hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900/20"
                              onClick={() => {
                                sdTelemetry("suggestion_edited");
                                setOverrides((prev) => ({
                                  ...prev,
                                  [base.id]: {
                                    ...(prev[base.id] || {}),
                                    removed: { ...(prev[base.id]?.removed || {}), [h]: true },
                                  },
                                }));
                              }}
                              aria-label={`Remove ${h}`}
                              title="Remove"
                            >
                              <X size={16} strokeWidth={2} className="text-gray-500" />
                            </button>
                          </span>
                        ))}
                      </div>
                      {(s as any).members.length > 12 ? (
                        <div className="text-xs text-gray-400 mt-2">+{(s as any).members.length - 12} more</div>
                      ) : null}

                      {!canAccept ? (
                        <div className="text-xs text-rose-600 mt-2 font-semibold">
                          Needs at least 2 members. Remove fewer people or skip this suggestion.
                        </div>
                      ) : null}

                      {o?.removed && Object.keys(o.removed).length > 0 ? (
                        <button
                          type="button"
                          className="mt-2 text-xs font-extrabold text-gray-600 hover:text-gray-900"
                          onClick={() => {
                            setOverrides((prev) => ({
                              ...prev,
                              [base.id]: { ...(prev[base.id] || {}), removed: {} },
                            }));
                          }}
                        >
                          Reset removed members
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
                      onClick={() => {
                        setRenameId(base.id);
                        setDraft(s.label);
                      }}
                      aria-label="Rename"
                      title="Rename"
                    >
                      <Pencil size={16} className="text-gray-700" />
                    </button>

                    <button
                      className={cn(
                        "px-3 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1",
                        canAccept ? "bg-gray-900 text-white hover:opacity-90" : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      )}
                      disabled={!canAccept}
                      onClick={() => {
                        sdTelemetry("suggestion_accepted");
                        onAccept(s);
                      }}
                    >
                      <Check size={14} />
                      Accept
                    </button>

                    <button
                      className="px-3 py-2 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200"
                      onClick={() => {
                        sdTelemetry("suggestion_skipped");
                        onSkip(base.id);
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>

                {renameId === base.id ? (
                  <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="text-xs font-bold text-gray-500 mb-2">Rename</div>
                    <div className="flex gap-2">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none"
                      />
                      <button
                        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:opacity-90"
                        onClick={() => {
                          sdTelemetry("suggestion_edited");
                          const next = (draft.trim() || s.label).slice(0, 64);
                          setOverrides((prev) => ({
                            ...prev,
                            [base.id]: { ...(prev[base.id] || {}), label: next },
                          }));
                          setRenameId(null);
                        }}
                      >
                        Save
                      </button>
                      <button className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200" onClick={() => setRenameId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <button className="w-full mt-6 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
