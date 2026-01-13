"use client";

import React, { useMemo, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { SuggestedSet } from "@/src/lib/setSuggestions";
import { SET_THEMES } from "@/src/lib/setThemes";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function SuggestedSetsSheet({
  open,
  onClose,
  suggestions,
  onAccept,
  onSkip,
}: {
  open: boolean;
  onClose: () => void;
  suggestions: SuggestedSet[];
  onAccept: (s: SuggestedSet) => void;
  onSkip: (id: string) => void;
}) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");

  const active = useMemo(() => {
    if (!renameId) return null;
    return suggestions.find((s) => s.id === renameId) ?? null;
  }, [renameId, suggestions]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-gray-900">Suggested Sets</div>
          <button className="p-2 rounded-full hover:bg-gray-100" onClick={onClose} aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          Based on your matches, you may want these Sets. You’re always in control.
        </div>

        <div className="space-y-3">
          {suggestions.map((s) => {
            const t = SET_THEMES[s.color] ?? SET_THEMES.orange;
            return (
              <div key={s.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={cn("inline-flex items-center gap-2 px-2 py-1 rounded-full border text-xs font-bold", t.bg, t.text, t.border)}>
                      {s.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{s.reason}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Members: {s.members.join(", ")}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
                      onClick={() => {
                        setRenameId(s.id);
                        setDraft(s.label);
                      }}
                      aria-label="Rename"
                      title="Rename"
                    >
                      <Pencil size={16} className="text-gray-700" />
                    </button>
                    <button
                      className="px-3 py-2 rounded-full bg-gray-900 text-white text-xs font-bold hover:opacity-90 inline-flex items-center gap-1"
                      onClick={() => onAccept(s)}
                    >
                      <Check size={14} />
                      Accept
                    </button>
                    <button
                      className="px-3 py-2 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200"
                      onClick={() => onSkip(s.id)}
                    >
                      Skip
                    </button>
                  </div>
                </div>

                {renameId === s.id ? (
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
                          // mutate label locally by passing accept with overridden label
                          onAccept({ ...s, label: draft.trim() || s.label });
                          setRenameId(null);
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200"
                        onClick={() => setRenameId(null)}
                      >
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
