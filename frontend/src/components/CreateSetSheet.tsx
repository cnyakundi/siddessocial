"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { Check, ChevronDown, Palette, Users, X } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import { SET_THEMES } from "@/src/lib/setThemes";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function CreateSetSheet(props: {
  open: boolean;
  onClose: () => void;

  /**
   * When true, default to showing Side/Theme options (power-user mode).
   * Sets page already uses ?advanced=1; we pass that through.
   */
  advanced?: boolean;

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
    advanced = false,
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

  const [showMore, setShowMore] = useState<boolean>(!!advanced);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  useEffect(() => {
    if (open) {
      setLocalErr(null);
      // MVP default: quick sheet (name + optional members).
      setShowMore(!!advanced);
    }
  }, [open, advanced]);

  const close = () => onClose();

  const createEnabled = useMemo(() => {
    if (!canWrite) return false;
    if (creating) return false;
    return Boolean(label.trim());
  }, [canWrite, creating, label]);

  const theme = SET_THEMES[color] ?? SET_THEMES.orange;
  const sideTheme = SIDE_THEMES[side];

  const createNow = async () => {
    if (!createEnabled) return;
    setLocalErr(null);
    try {
      await onCreate(label, membersRaw, side, color);
      close();
    } catch (e: any) {
      setLocalErr(e?.message || "Create failed.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center md:items-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onPointerDown={(e) => {
          // sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps (close on click)
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          close();
        }}
        aria-label="Close"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="create-set-title"
        className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div id="create-set-title" className="text-sm font-black text-gray-900">New Set</div>
              <div className="text-[11px] text-gray-500 mt-1">
                Quick create • Name + optional members
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

          {/* Context preview */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn("h-8 w-8 rounded-full border flex-shrink-0", sideTheme.border, sideTheme.lightBg)} aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Side</div>
                <div className="text-sm font-extrabold text-gray-900 truncate">{SIDES[side]?.label ?? side}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <div className={cn("h-8 w-8 rounded-full border flex-shrink-0", theme.border, theme.bg)} aria-hidden="true" />
              <div className="min-w-0 text-right">
                <div className="text-xs text-gray-500">Theme</div>
                <div className="text-sm font-extrabold text-gray-900 truncate capitalize">{color}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={cn(
              "mt-3 w-full px-3 py-2 rounded-2xl border text-sm font-bold flex items-center justify-center gap-2",
              "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
            )}
            aria-expanded={showMore}
          >
            <ChevronDown size={16} className={cn("transition-transform", showMore ? "rotate-180" : "rotate-0")} />
            {showMore ? "Hide options" : "More options"}
          </button>
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
          <div>
            <div className="text-sm font-bold text-gray-900 mb-2">Name</div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Weekend Crew"
              autoFocus
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
            />
            <div className="text-[11px] text-gray-500 mt-2">
              This Set will be created inside <span className="font-bold">{SIDES[side]?.label ?? side}</span>.
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Users size={16} />
              Members (optional)
            </div>
            <textarea
              value={membersRaw}
              onChange={(e) => setMembersRaw(e.target.value)}
              placeholder="@sarah, @marc_us\n@elena"
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
            />
            <div className="text-[11px] text-gray-400 mt-1">Comma or newline separated. We auto-add “@”. You can add people later.</div>
          </div>

          {showMore ? (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">Options</div>

              {/* Side */}
              <div className="mt-3">
                <div className="text-sm font-bold text-gray-900 mb-2">Side</div>
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

              {/* Theme */}
              <div className="mt-4">
                <div className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Palette size={16} />
                  Theme
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
                  <div className="text-xs text-gray-600 mt-1">Set chips and cards will use this theme color.</div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!createEnabled}
            onClick={() => void createNow()}
            className={cn(
              "w-full mt-5 py-2.5 rounded-xl font-bold text-sm border flex items-center justify-center gap-2",
              !createEnabled
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
            )}
          >
            <Check size={16} />
            {creating ? "Creating..." : "Create Set"}
          </button>
        </div>
      </div>
    </div>
  );
}
