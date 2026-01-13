"use client";

import React, { useMemo } from "react";
import { HelpCircle, MessageSquareQuote } from "lucide-react";
import {
  badgeForSlateTrust,
  labelForSlateKind,
  listPublicSlate,
  type PublicSlateEntry,
} from "@/src/lib/mockPublicSlate";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function KindIcon({ kind }: { kind: PublicSlateEntry["kind"] }) {
  return kind === "question" ? (
    <HelpCircle size={14} className="text-gray-400" />
  ) : (
    <MessageSquareQuote size={14} className="text-gray-400" />
  );
}

export function PublicSlate({
  targetHandle,
  className,
}: {
  targetHandle: string;
  className?: string;
}) {
  const entries = useMemo(() => listPublicSlate(targetHandle), [targetHandle]);

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Slate
          </div>
          <div className="text-sm text-gray-700">
            Public notes + questions (trusted voices first — later we’ll enforce).
          </div>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 text-gray-500"
          disabled
          title="Coming soon"
        >
          Write
        </button>
      </div>

      {entries.length ? (
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
  const trust = badgeForSlateTrust(entry.trustLevel);
  const kindLabel = labelForSlateKind(entry.kind);

  return (
    <div className="p-3 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 leading-snug">
            {entry.fromName}
            <span className="text-xs font-semibold text-gray-400 ml-2">
              {entry.fromHandle}
            </span>
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
