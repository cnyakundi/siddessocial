"use client";

// sd_338: Create Ritual sheet (Set-scoped v1)

import React, { useEffect, useMemo, useState, useRef } from "react";
import { BookOpen, HelpCircle, Smile, Sparkles, X } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { RitualKind, RitualItem } from "@/src/lib/ritualsTypes";
import { getRitualsProvider } from "@/src/lib/ritualsProvider";
import { toast } from "@/src/lib/toast";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const KIND_PRESETS: Array<{ kind: RitualKind; label: string; title: string; prompt: string; Icon: any }> = [
  { kind: "mood", label: "Mood", title: "Vibe Check", prompt: "Mood check — how are you today?", Icon: Smile },
  { kind: "reading", label: "Reading", title: "Reading List", prompt: "What are you reading right now?", Icon: BookOpen },
  { kind: "question", label: "Question", title: "Quick Question", prompt: "Quick question for your people…", Icon: HelpCircle },
];

export function RitualCreateSheet({
  open,
  onClose,
  side,
  setId,
  setLabel,
  initialKind = "mood",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  side: SideId;
  setId: string | null;
  setLabel: string;
  initialKind?: RitualKind;
  onCreated?: (r: RitualItem) => void;
}) {
  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });
  const theme = SIDE_THEMES[side];
  const provider = useMemo(() => getRitualsProvider(), []);

  const [kind, setKind] = useState<RitualKind>(initialKind);
  const preset = useMemo(() => KIND_PRESETS.find((k) => k.kind === kind) || KIND_PRESETS[0], [kind]);

  const [title, setTitle] = useState(preset.title);
  const [prompt, setPrompt] = useState(preset.prompt);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // reset to preset each open
    setKind(initialKind);
  }, [open, initialKind]);

  useEffect(() => {
    // when kind changes, refresh defaults only if user hasn't started typing
    setTitle((prev) => (prev ? prev : preset.title));
    setPrompt((prev) => (prev ? prev : preset.prompt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  if (!open) return null;

  const disabled = busy || !setId || !prompt.trim();


  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center md:items-center"> 
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onPointerDown={(e) => {
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
      }} />

      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="ritual-create-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200"> 
        <div className="flex items-center justify-between gap-3 mb-4"> 
          <div>
            <h3 id="ritual-create-title" className="text-lg font-bold text-gray-900">Start a Ritual</h3>
            <div className="text-xs text-gray-500 mt-1">Pulse for <span className="font-semibold text-gray-800">{setLabel}</span>.</div>
          </div>
          <button type="button" ref={closeBtnRef} onClick={onClose} className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50" aria-label="Close"> 
            <X size={16} />
          </button>
        </div>

        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {KIND_PRESETS.map((k) => {
              const active = kind === k.kind;
              return (
                <button
                  key={String(k.kind)}
                  type="button"
                  onClick={() => {
                    setKind(k.kind);
                    setTitle(k.title);
                    setPrompt(k.prompt);
                  }}
                  className={cn(
                    "px-3 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-2",
                    active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <k.Icon size={14} className={active ? "text-white" : "text-gray-500"} />
                  {k.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 ring-gray-900"
              placeholder={preset.title}
              maxLength={128}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 ring-gray-900 min-h-[88px]"
              placeholder={preset.prompt}
              maxLength={220}
            />
            <div className="mt-1 flex items-center justify-between">
              <span className={cn("text-[10px] font-bold uppercase tracking-widest", theme.text)}>
                {SIDES[side].isPrivate ? "Audience locked" : "Public"} • {SIDES[side].label}
              </span>
              <span className="text-[10px] text-gray-400">{prompt.trim().length}/220</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={async () => {
            if (!setId) {
              toast.error("Pick a Circle first to start a ritual.");
              return;
            }
            const p = prompt.trim();
            if (!p) return;
            setBusy(true);
            try {
              const r = await provider.create({
                side,
                setId,
                kind,
                title: title.trim() || preset.title,
                prompt: p,
              });
              toast.success("Ritual created.");
              onCreated?.(r);
              onClose();
            } catch (e: any) {
              toast.error(String(e?.message || "Could not create ritual"));
            } finally {
              setBusy(false);
            }
          }}
          className={cn(
            "w-full mt-5 py-3 rounded-xl font-extrabold text-sm inline-flex items-center justify-center gap-2 transition",
            disabled ? "bg-gray-200 text-gray-500" : cn(theme.primaryBg, "text-white hover:opacity-95")
          )}
        >
          <Sparkles size={16} />
          Start Ritual
        </button>

        <button type="button" onClick={onClose} className="w-full mt-3 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">Cancel</button>
      </div>
    </div>
  );
}
