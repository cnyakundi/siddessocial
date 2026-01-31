"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Plus, X } from "lucide-react";
import type { CircleDef } from "@/src/lib/circles";
import { getCirclesProvider } from "@/src/lib/circlesProvider";
import { toast } from "@/src/lib/toast";
import { fetchMe } from "@/src/lib/authMe";
import { normalizeHandle } from "@/src/lib/mentions";
import { emitCirclesChanged } from "@/src/lib/circlesSignals";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function parseHandles(raw: string): string[] {
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

export function AddPeopleSheet(props: {
  open: boolean;
  onClose: () => void;

  setId: string | null | undefined;
  canWrite: boolean;

  existingMembers: string[];
  onUpdated?: (next: CircleDef | null) => void;

  onUseInviteLink?: (() => void) | null;
}) {
  const { open, onClose, setId, canWrite, existingMembers, onUpdated, onUseInviteLink } = props;

  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [meHandle, setMeHandle] = useState<string>(""); // sd_848_addpeople_self_guard

  useLockBodyScroll(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  useEffect(() => {
    if (!open) return;
    setRaw("");
    setErr(null);
    setSaving(false);

    // sd_848_addpeople_self_guard_me_effect: prevent adding yourself to your own Circle
    (async () => {
      const me = await fetchMe().catch(() => ({ ok: false, authenticated: false } as any));
      const u = me?.authenticated && me?.user?.username ? String(me.user.username).trim() : "";
      const h = u ? normalizeHandle("@" + u) : "";
      setMeHandle(h || "");
    })();
  }, [open]);

  const existing = useMemo(() => {
    const list = Array.isArray(existingMembers) ? existingMembers.filter(Boolean) : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of list) {
      const h = normalizeHandle(p);
      if (!h) continue;
      if (seen.has(h)) continue;
      seen.add(h);
      out.push(h);
    }
    return out;
  }, [existingMembers]);

  const toAdd = useMemo(() => {
    const list = parseHandles(raw);
    const existingSet = new Set(existing);
    return list.filter((h) => !existingSet.has(h));
  }, [raw, existing]);

  const canSubmit = !!setId && canWrite && !saving && toAdd.length > 0;

  const submit = async () => {
    if (!canSubmit || !setId) return;
    setErr(null);
    setSaving(true);
    try {
      const provider = getCirclesProvider();
      const nextMembers = Array.from(new Set([...existing, ...toAdd]));
      const updated = await provider.update(setId, { members: nextMembers });
      if (!updated) throw new Error("Circle not found.");
      toast("People added", { variant: "success" });
      try {
        emitCirclesChanged();
      } catch {}
      onUpdated?.(updated);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to add people.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[165] flex items-end justify-center md:items-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onPointerDown={(e) => {
          // sd_713_backdrop_clickthrough
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
        aria-label="Close"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="add-people-title"
        className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto"
      >
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <div id="add-people-title" className="text-sm font-black text-gray-900">
              Add people
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Type, paste, or (soon) voice. Comma or newline separated.
            </div>
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

        <div className="p-4">
          {!canWrite ? (
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm text-gray-600">
              Read-only: you can’t add people in this view.
            </div>
          ) : null}

          <div className="mt-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">Handles</div>
              <button
                type="button"
                className="px-2 py-1 rounded-full border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1"
                disabled
                aria-disabled="true"
                title="Voice coming soon"
              >
                <Mic size={14} />
                Voice (soon)
              </button>
            </div>

            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="@sarah, @marc_us\n@elena"
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
            />
            <div className="text-[11px] text-gray-400 mt-1">
              We auto-add “@”. Existing members won’t be duplicated.
            </div>

            {meHandle && parseHandles(raw).includes(meHandle) ? (
              <div className="text-[11px] text-amber-600 mt-1">Note: you can’t add yourself — your handle is ignored.</div> // sd_848_addpeople_self_guard_hint
            ) : null}
          </div>

          {toAdd.length ? (
            <div className="mt-4">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">To add</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {toAdd.slice(0, 24).map((h) => (
                  <span key={h} className="px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700">
                    {h}
                  </span>
                ))}
                {toAdd.length > 24 ? (
                  <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-bold text-gray-500">
                    +{toAdd.length - 24} more
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {err ? (
            <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className={cn(
                "w-full py-3 rounded-xl font-black text-sm inline-flex items-center justify-center gap-2",
                canSubmit ? "bg-gray-900 text-white hover:bg-black" : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              <Plus size={16} />
              {saving ? "Adding..." : "Add"}
            </button>

            {onUseInviteLink ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onUseInviteLink?.();
                }}
                className="w-full py-3 rounded-xl font-bold text-sm border border-gray-200 bg-white hover:bg-gray-50"
              >
                Use invite link instead
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl font-semibold text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
