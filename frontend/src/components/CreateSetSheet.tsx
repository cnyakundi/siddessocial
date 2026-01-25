"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { ArrowLeft, Check, ChevronRight, Palette, Users, X } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import { SET_THEMES } from "@/src/lib/setThemes";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type Step = "name" | "side" | "theme" | "members" | "review";

export function CreateSetSheet(props: {
  open: boolean;
  onClose: () => void;

  // Permissions + status
  canWrite: boolean;
  creating: boolean;
  err?: string | null;

  // Controlled inputs (owned by parent page)
  label: string;
  setLabel: (v: string) => void;

  side: SideId;
  setSide: (v: SideId) => void;

  color: SetColor;
  setColor: (v: SetColor) => void;

  membersRaw: string;
  setMembersRaw: (v: string) => void;

  onCreate: (label: string, membersRaw: string, side: SideId, color?: SetColor) => Promise<any>;
}) {
  const {
    open,
    onClose,
    canWrite,
    creating,
    err,
    label,
    setLabel,
    side,
    setSide,
    color,
    setColor,
    membersRaw,
    setMembersRaw,
    onCreate,
  } = props;

  const [step, setStep] = useState<Step>("name");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  const steps: Step[] = useMemo(() => ["name", "side", "theme", "members", "review"], []);
  const stepIdx = steps.indexOf(step);
  const stepNum = stepIdx >= 0 ? stepIdx + 1 : 1;

  useEffect(() => {
    if (open) {
      setStep("name");
      setLocalErr(null);
    }
  }, [open]);

  const close = () => onClose();

  const nextEnabled = useMemo(() => {
    if (!canWrite) return false;
    if (creating) return false;

    if (step === "name") return Boolean(label.trim());
    return true;
  }, [canWrite, creating, step, label]);

  const next = () => {
    if (!nextEnabled) return;
    const idx = steps.indexOf(step);
    if (idx < 0) return;
    const nxt = steps[Math.min(idx + 1, steps.length - 1)];
    setStep(nxt);
  };

  const back = () => {
    if (creating) return;
    const idx = steps.indexOf(step);
    if (idx <= 0) return;
    const prev = steps[idx - 1];
    setStep(prev);
  };

  const createNow = async () => {
    setLocalErr(null);
    try {
      await onCreate(label, membersRaw, side, color);
      close();
    } catch (e: any) {
      setLocalErr(e?.message || "Create failed.");
    }
  };

  if (!open) return null;

  const theme = SET_THEMES[color] ?? SET_THEMES.orange;

  return (
    <div className="fixed inset-0 z-[99] flex items-end justify-center md:items-center">
      {/* Backdrop */}
      <button type="button" className="absolute inset-0 bg-black/40" onPointerDown={(e) => {
        // sd_481_sheet_close_reliability: pointerdown closes reliably on mobile
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        e.preventDefault();
        close();
      }} aria-label="Close" />

      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="create-set-title" className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {step !== "name" ? (
                <button
                  type="button"
                  onClick={back}
                  disabled={creating}
                  className={cn(
                    "p-2 rounded-full border text-sm font-bold",
                    creating ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                  aria-label="Back"
                >
                  <ArrowLeft size={16} />
                </button>
              ) : (
                <div className="w-10" />
              )}

              <div>
                <div id="create-set-title" className="text-sm font-black text-gray-900">Create Set</div>
                <div className="text-[11px] text-gray-500">
                  Step {stepNum}/{steps.length} • Name → Side → Theme → Members → Create
                </div>
              </div>
            </div>

            <button
              type="button"
              ref={closeBtnRef}
              onClick={close}
              className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-1 mt-3">
            {steps.map((s) => {
              const active = steps.indexOf(s) <= stepIdx;
              return (
                <div
                  key={s}
                  className={cn("h-1.5 rounded-full flex-1", active ? "bg-gray-900" : "bg-gray-200")}
                  aria-hidden="true"
                />
              );
            })}
          </div>
        </div>

        {/* Errors */}
        {!canWrite ? (
          <div className="px-4 pt-4">
            <div className="p-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
              <div className="font-bold">Create disabled (read-only)</div>
              <div className="text-xs mt-1">
                Set creation is enforced server-side. If you do not have permission, you will see an error.
              </div>
            </div>
          </div>
        ) : null}

        {(localErr || err) ? (
          <div className="px-4 pt-4">
            <div className="p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
              <div className="font-bold">Error</div>
              <div className="text-xs mt-1">{localErr || err}</div>
            </div>
          </div>
        ) : null}

        {/* Body */}
        <div className="px-4 py-4">
          {step === "name" ? (
            <div>
              <div className="text-sm font-bold text-gray-900 mb-2">Name your Set</div>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Weekend Crew"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
              />
              <div className="text-[11px] text-gray-500 mt-2">
                Tip: keep it short. This name appears in invites and the Set header.
              </div>
            </div>
          ) : null}

          {step === "side" ? (
            <div>
              <div className="text-sm font-bold text-gray-900 mb-2">Choose a Side</div>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(SIDES) as SideId[]).map((sid) => {
                  const meta = SIDES[sid];
                  const t = SIDE_THEMES[sid];
                  const active = sid === side;
                  return (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => setSide(sid)}
                      className={cn(
                        "text-left p-3 rounded-2xl border transition",
                        active ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-gray-900">{meta.label}</div>
                          <div className="text-xs text-gray-600 mt-1">{meta.privacyHint}</div>
                        </div>
                        <div className={cn("h-8 w-8 rounded-full border", t.border, t.lightBg)} aria-hidden="true" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === "theme" ? (
            <div>
              <div className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Palette size={16} />
                Pick a theme
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SET_THEMES) as SetColor[]).filter((c) => c !== "blue").map((c) => {
                  const th = SET_THEMES[c];
                  const active = c === color;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "p-3 rounded-2xl border text-left",
                        active ? "border-gray-900" : "border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <div className={cn("h-8 w-full rounded-xl border", th.border, th.bg)} />
                      <div className={cn("text-xs font-bold mt-2 capitalize", th.text)}>{c}</div>
                    </button>
                  );
                })}
              </div>

              <div className={cn("mt-3 p-3 rounded-2xl border", theme.border, theme.bg)}>
                <div className={cn("text-sm font-black", theme.text)}>Preview</div>
                <div className="text-xs text-gray-600 mt-1">
                  Set cards and header chips will use this theme color.
                </div>
              </div>
            </div>
          ) : null}

          {step === "members" ? (
            <div>
              <div className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Users size={16} />
                Add members (optional)
              </div>

              <textarea
                value={membersRaw}
                onChange={(e) => setMembersRaw(e.target.value)}
                placeholder="@sarah, @marc_us\n@elena"
                rows={5}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
              />

              <div className="text-[11px] text-gray-400 mt-1">Comma or newline separated. We auto-add “@”.</div>
            </div>
          ) : null}

          {step === "review" ? (
            <div>
              <div className="text-sm font-bold text-gray-900 mb-2">Review</div>

              <div className="p-3 rounded-2xl border border-gray-200 bg-white">
                <div className="text-xs text-gray-500">Name</div>
                <div className="font-black text-gray-900">{label.trim() || "—"}</div>

                <div className="mt-3 text-xs text-gray-500">Side</div>
                <div className="font-bold text-gray-900">{SIDES[side]?.label ?? side}</div>

                <div className="mt-3 text-xs text-gray-500">Theme</div>
                <div className="font-bold text-gray-900 capitalize">{color}</div>

                <div className="mt-3 text-xs text-gray-500">Members</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {membersRaw.trim() ? membersRaw.trim() : "—"}
                </div>
              </div>

              <button
                type="button"
                disabled={!canWrite || creating || !label.trim()}
                onClick={() => void createNow()}
                className={cn(
                  "w-full mt-3 py-2.5 rounded-xl font-bold text-sm border flex items-center justify-center gap-2",
                  !canWrite || creating || !label.trim()
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
                )}
              >
                <Check size={16} />
                {creating ? "Creating..." : "Create Set"}
              </button>
            </div>
          ) : null}
        </div>

        {/* Footer nav */}
        <div className="px-4 pb-4">
          {step !== "review" ? (
            <button
              type="button"
              disabled={!nextEnabled}
              onClick={next}
              className={cn(
                "w-full py-2.5 rounded-xl font-bold text-sm border flex items-center justify-center gap-2",
                !nextEnabled
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
              )}
            >
              <ChevronRight size={16} />
              Next
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
