"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CloudOff, Cpu, UserPlus, Users } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDE_THEMES } from "@/src/lib/sides";
import { getSetsProvider } from "@/src/lib/setsProvider";
import type { SetDef } from "@/src/lib/sets";
import { loadQueue, queueChangedEventName } from "@/src/lib/offlineQueue";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
};

/**
 * DesktopContextInspectorRail
 * - Collapsed: a narrow handle with status dots (Outbox/Suggestions)
 * - Expanded: Context card + high-signal modules (Outbox + Sets)
 * - Selection-aware behavior can be layered later via events.
 */
export function DesktopContextInspectorRail({ expanded, onExpandedChange }: Props) {
  const { side } = useSide();
  const theme = SIDE_THEMES[side];

  const setsProvider = useMemo(() => getSetsProvider(), []);
  const [sets, setSets] = useState<SetDef[]>([]);
  const [setsErr, setSetsErr] = useState<string | null>(null);

  const [queued, setQueued] = useState(0);

  // Load sets for this side (quiet utility)
  useEffect(() => {
    let alive = true;
    setSetsErr(null);

    setsProvider
      .list({ side })
      .then((items) => {
        if (!alive) return;
        setSets(Array.isArray(items) ? items.slice(0, 6) : []);
      })
      .catch((e) => {
        if (!alive) return;
        setSets([]);
        setSetsErr(String((e as any)?.message || "Failed to load sets"));
      });

    return () => {
      alive = false;
    };
  }, [side, setsProvider]);

  // Side-scoped outbox count (truth UI)
  useEffect(() => {
    const refresh = () => {
      const items = loadQueue();
      const n = Array.isArray(items) ? items.filter((x: any) => x && x.side === side).length : 0;
      setQueued(n);
    };
    refresh();
    const evt = queueChangedEventName();
    window.addEventListener(evt, refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener(evt, refresh);
      window.removeEventListener("online", refresh);
    };
  }, [side]);

  if (!expanded) {
    return (
      <aside className="w-full border-l border-gray-100 bg-white/80 backdrop-blur sticky top-20 h-[calc(100vh-80px)] flex flex-col items-center py-6">
        <button
          type="button"
          onClick={() => onExpandedChange(true)}
          className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          title="Open Butler"
          aria-label="Open Butler"
        >
          <Cpu size={22} strokeWidth={2.5} />
        </button>

        <div className="mt-8 flex flex-col gap-6">
          <button
            type="button"
            onClick={() => onExpandedChange(true)}
            className="relative p-2 rounded-xl hover:bg-gray-50 text-gray-300 hover:text-gray-900 transition-colors"
            title="Outbox"
            aria-label="Outbox"
          >
            <CloudOff size={22} />
            {queued > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[8px] font-black flex items-center justify-center border-2 border-white">
                {queued > 9 ? "9+" : String(queued)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onExpandedChange(true)}
            className="relative p-2 rounded-xl hover:bg-gray-50 text-gray-300 hover:text-gray-900 transition-colors"
            title="Suggestions"
            aria-label="Suggestions"
          >
            <UserPlus size={22} />
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-blue-500 border-2 border-white" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onExpandedChange(true)}
          className="mt-auto mb-6 p-3 bg-white rounded-xl border border-gray-100 text-gray-300 hover:text-gray-900 transition-colors"
          title="Expand"
          aria-label="Expand"
        >
          <ChevronLeft size={18} strokeWidth={2.5} className="rotate-180" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-full border-l border-gray-100 bg-white/80 backdrop-blur sticky top-20 h-[calc(100vh-80px)] overflow-y-auto">
      <div className="p-6 flex flex-col gap-6 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-gray-400">
            <Cpu size={14} className="text-gray-900" />
            Butler
          </div>
          <button
            type="button"
            onClick={() => onExpandedChange(false)}
            className="p-2 rounded-xl border border-gray-100 text-gray-300 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            title="Collapse"
            aria-label="Collapse"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Context card */}
        <div className="p-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn("w-2.5 h-2.5 rounded-full", theme.primaryBg)} />
            <div className={cn("text-[10px] font-extrabold uppercase tracking-widest", theme.text)}>
              {side} locked
            </div>
          </div>
          <div className="text-sm font-bold text-gray-900">Context sealed</div>
          <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-50">
            <div className="text-xs text-gray-500">{queued > 0 ? `${queued} queued` : "No queued items"}</div>
            <Link href="/siddes-profile/account" className="text-xs font-bold text-gray-600 hover:underline">
              Account
            </Link>
          </div>
        </div>

        {/* Outbox mini (only when relevant) */}
        {queued > 0 && (
          <div className="p-5 rounded-2xl border border-orange-100 bg-orange-50/50 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
                <CloudOff size={14} className="text-orange-600" />
                Outbox
              </div>
              <span className="text-xs font-black text-orange-700">{queued}</span>
            </div>
            <div className="text-xs text-orange-900/70 leading-relaxed mb-3">
              Items are queued for encryption/sync in this Side.
            </div>
            <Link
              href="/siddes-profile"
              className="block text-center w-full py-2.5 bg-white border border-orange-200 text-orange-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-md transition-all"
            >
              Open Outbox
            </Link>
          </div>
        )}

        {/* Sets module (side-aware) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Sets</div>
            <Link
              href="/siddes-sets"
              className="text-xs font-bold text-gray-500 hover:text-gray-900 hover:underline"
              aria-label="Manage sets"
              title="Manage sets"
            >
              Manage
            </Link>
          </div>

          {setsErr ? (
            <div className="text-xs text-gray-500">Couldn't load sets.</div>
          ) : sets.length ? (
            <div className="space-y-3">
              {sets.map((s) => (
                <Link
                  key={s.id}
                  href={`/siddes-sets/${encodeURIComponent(String(s.id))}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center", theme.lightBg)}>
                    <Users size={16} className={theme.text} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{s.label}</div>
                    <div className="text-xs text-gray-500">{s.count ?? 0} members</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              No sets yet.{" "}
              <Link href="/siddes-sets" className="font-bold hover:underline">
                Create one
              </Link>
              .
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
