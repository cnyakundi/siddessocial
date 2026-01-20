"use client";

import React, { useEffect, useMemo, useState } from "react";
import { HelpCircle, MessageSquareQuote } from "lucide-react";
import { labelForTrustLevel, normalizeTrustLevel, type TrustLevel } from "@/src/lib/trustLevels";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type PublicSlateEntryKind = "vouch" | "question";

type PublicSlateEntry = {
  id: string;
  targetHandle: string;
  fromUserId: string;
  fromName: string;
  fromHandle: string;
  kind: PublicSlateEntryKind;
  text: string;
  trustLevel: TrustLevel;
  ts?: number;
};

function KindIcon({ kind }: { kind: PublicSlateEntryKind }) {
  return kind === "question" ? (
    <HelpCircle size={14} className="text-gray-400" />
  ) : (
    <MessageSquareQuote size={14} className="text-gray-400" />
  );
}

function labelForKind(kind: PublicSlateEntryKind): string {
  return kind === "vouch" ? "Vouch" : "Question";
}

export function PublicSlate({
  targetHandle,
  className,
}: {
  targetHandle: string;
  className?: string;
}) {
  const [items, setItems] = useState<PublicSlateEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const target = (targetHandle || "").toString();

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!target) {
        setItems([]);
        return;
      }

      setLoading(true);
      try {
        const u = new URL("/api/slate", window.location.origin);
        u.searchParams.set("target", target);
        const res = await fetch(u.toString(), { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as any;
        if (!mounted) return;

        const rawItems = (j && typeof j === "object" && Array.isArray(j.items) ? j.items : []) as any[];
        const norm: PublicSlateEntry[] = rawItems
          .map((e) => {
            const kind = (String(e?.kind || "") as any) as PublicSlateEntryKind;
            if (kind !== "vouch" && kind !== "question") return null;
            return {
              id: String(e?.id || ""),
              targetHandle: String(e?.targetHandle || target),
              fromUserId: String(e?.fromUserId || ""),
              fromName: String(e?.fromName || ""),
              fromHandle: String(e?.fromHandle || ""),
              kind,
              text: String(e?.text || ""),
              trustLevel: normalizeTrustLevel(e?.trustLevel, 1),
              ts: typeof e?.ts === "number" ? e.ts : undefined,
            };
          })
          .filter(Boolean) as PublicSlateEntry[];

        setItems(norm);
      } catch {
        if (!mounted) return;
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [target]);

  const entries = useMemo(() => items, [items]);

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Slate</div>
          <div className="text-sm text-gray-700">
            Public notes + questions (trusted voices first).
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
          Loading slate…
        </div>
      ) : entries.length ? (
        <div className="grid gap-2">
          {entries.map((e) => (
            <SlateEntryCard key={e.id} entry={e} />
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
          No slate entries yet.
        </div>
      )}
    </div>
  );
}

function SlateEntryCard({ entry }: { entry: PublicSlateEntry }) {
  const trust = labelForTrustLevel(entry.trustLevel);
  const kindLabel = labelForKind(entry.kind);

  return (
    <div className="p-3 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 leading-snug">
            {entry.fromName}
            <span className="text-xs font-semibold text-gray-400 ml-2">{entry.fromHandle}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 font-bold">
              {trust}
            </span>
            <span className="inline-flex items-center gap-1">
              <KindIcon kind={entry.kind} />
              {kindLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-800 mt-2 leading-relaxed">{entry.text}</div>
    </div>
  );
}
