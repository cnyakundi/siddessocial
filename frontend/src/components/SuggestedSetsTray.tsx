"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { SuggestedSetsSheet } from "@/src/components/SuggestedSetsSheet";
import type { SuggestedSet } from "@/src/lib/setSuggestions";
import type { SideId } from "@/src/lib/sides";

function normLabel(label: string): string {
  const v = String(label || "").trim();
  return (v || "Untitled").slice(0, 64);
}
import { loadSuggestedSetsCache, saveSuggestedSetsCache } from "@/src/lib/localIntelligence/localSuggestedSetsCache";
import {
  clearSuggestionDecision,
  isSuggestionSuppressed,
  markSuggestionAccepted,
  markSuggestionDismissed,
} from "@/src/lib/localIntelligence/localSuggestionLedger";
import { sdTelemetry } from "@/src/lib/telemetry/sdTelemetry";

type MeResp = {
  ok: boolean;
  authenticated?: boolean;
  user?: { id: number };
  viewerId?: string;
};

type UndoToast = {
  token: string;
  setIds: string[];
  suggestions: SuggestedSet[];
  message: string;
  busy?: boolean;
};

function computeViewerKey(me: MeResp | null): string {
  const v = me?.viewerId ? String(me.viewerId).trim() : "";
  if (v) return v;
  const uid = me?.user?.id;
  return uid ? `me_${uid}` : "anon";
}

function dedupeById(items: SuggestedSet[]): SuggestedSet[] {
  const out: SuggestedSet[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const id = String((it as any)?.id || "").trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

export function SuggestedSetsTray({ onCreated }: { onCreated?: () => void }) {
  const [me, setMe] = useState<MeResp | null>(null);
  const viewerKey = useMemo(() => computeViewerKey(me), [me]);

  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedSet[]>([]);
  const [busy, setBusy] = useState(false);

  const undoTimerRef = useRef<number | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d))
      .catch(() => setMe({ ok: true, authenticated: false }));
  }, []);

  useEffect(() => {
    const cached = loadSuggestedSetsCache(viewerKey);
    const filtered = cached.filter((s) => !isSuggestionSuppressed(viewerKey, s.id));
    setSuggestions(filtered);

    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, [viewerKey]);

  function persist(next: SuggestedSet[]) {
    const clean = dedupeById(next);
    setSuggestions(clean);
    saveSuggestedSetsCache(viewerKey, clean);
  }

  function armUndo(setIds: string[], ss: SuggestedSet[]) {
    const ids = (setIds || []).map((x) => String(x || "").trim()).filter(Boolean);
    if (!ids.length) return;

    const token = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const message = ids.length === 1 ? "Set created." : `${ids.length} sets created.`;
    setUndoToast({ token, setIds: ids, suggestions: ss, message });

    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast((cur) => (cur && cur.token === token ? null : cur));
    }, 8000);
  }

  async function undoLastCreate() {
    const u = undoToast;
    if (!u || u.busy) return;
    setUndoToast({ ...u, busy: true });

    try {
      for (const id of u.setIds) {
        const res = await fetch(`/api/sets/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete_failed");
      }

      sdTelemetry("suggestion_undo", u.suggestions.length || 1);

      // Restore suggestions + clear local decisions
      for (const s of u.suggestions) clearSuggestionDecision(viewerKey, s.id);

      persist(u.suggestions.concat(suggestions));
      setOpen(true);
      setUndoToast(null);
      onCreated?.();
    } catch {
      setUndoToast((cur) => (cur ? { ...cur, busy: false, message: "Undo failed." } : cur));
    }
  }

  async function createOne(s: SuggestedSet): Promise<string> {
    const side = ((s as any).side as SideId | undefined) || "friends";
    const body = { side, label: normLabel(s.label), members: s.members, color: s.color };

    const res = await fetch("/api/sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("create_failed");
    const id = data?.item?.id ? String(data.item.id) : "";
    if (!id) throw new Error("missing_id");
    return id;
  }

  async function createMany(ss: SuggestedSet[]): Promise<string[]> {
    const inputs = ss.map((s) => ({
      side: (((s as any).side as SideId | undefined) || "friends"),
      label: normLabel(s.label),
      members: s.members,
      color: s.color,
    }));

    const res = await fetch("/api/sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inputs }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("bulk_failed");
    const ids = Array.isArray(data?.items) ? data.items.map((it: any) => String(it?.id || "")).filter(Boolean) : [];
    return ids;
  }

  async function acceptOne(s: SuggestedSet) {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createOne(s);
      markSuggestionAccepted(viewerKey, s.id);
      sdTelemetry("suggestion_accepted", 1);

      const next = suggestions.filter((x) => x.id !== s.id);
      persist(next);
      armUndo([id], [s]);

      onCreated?.();
    } finally {
      setBusy(false);
    }
  }

  async function acceptMany(ss: SuggestedSet[]) {
    if (busy) return;
    setBusy(true);
    try {
      const ids = await createMany(ss);
      ss.forEach((s) => markSuggestionAccepted(viewerKey, s.id));
      sdTelemetry("suggestion_accepted", ss.length);

      const idset = new Set(ss.map((s) => s.id));
      const next = suggestions.filter((x) => !idset.has(x.id));
      persist(next);
      armUndo(ids, ss);

      onCreated?.();
    } finally {
      setBusy(false);
    }
  }

  function skipOne(id: string) {
    markSuggestionDismissed(viewerKey, id);
    sdTelemetry("suggestion_skipped", 1);
    const next = suggestions.filter((x) => x.id !== id);
    persist(next);
  }

  function skipMany(ids: string[]) {
    ids.forEach((id) => markSuggestionDismissed(viewerKey, id));
    sdTelemetry("suggestion_skipped", ids.length);
    const idset = new Set(ids);
    const next = suggestions.filter((x) => !idset.has(x.id));
    persist(next);
  }

  if (!suggestions.length) return null;

  return (
    <>
      <div className="mb-3 p-3 rounded-2xl bg-white border border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-gray-700" />
              <div className="font-extrabold text-gray-900">Suggested Sets</div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"} ready. Review before you accept.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-full bg-gray-900 text-white text-xs font-extrabold hover:opacity-90 disabled:opacity-60"
            disabled={busy}
          >
            Review
          </button>
        </div>

        <SuggestedSetsSheet
          open={open}
          onClose={() => setOpen(false)}
          suggestions={suggestions}
          onAccept={acceptOne}
          onAcceptMany={acceptMany}
          onSkip={skipOne}
          onSkipMany={skipMany}
        />
      </div>

      {undoToast ? (
        <div className="fixed left-0 right-0 bottom-4 z-[120] px-4 flex justify-center">
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">{undoToast.message}</div>
            <button
              type="button"
              onClick={undoLastCreate}
              disabled={!!undoToast.busy}
              className={
                "px-4 py-2 rounded-full text-xs font-extrabold border " +
                (undoToast.busy ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-gray-900 text-white border-gray-900 hover:opacity-90")
              }
            >
              {undoToast.busy ? "Undoing..." : "Undo"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
