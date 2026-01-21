"use client";

import Link from "next/link";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DownloadCloud, Plus, RefreshCcw, Search } from "lucide-react";

import { ImportSetSheet } from "@/src/components/ImportSetSheet";
import { SuggestedSetsTray } from "@/src/components/SuggestedSetsTray";
import { CreateSetSheet } from "@/src/components/CreateSetSheet";
import { getSetsProvider } from "@/src/lib/setsProvider";
import type { SetDef } from "@/src/lib/sets";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import { getSetTheme } from "@/src/lib/setThemes";
import { onSetsChanged } from "@/src/lib/setsSignals";
import { useReturnScrollRestore } from "@/src/hooks/returnScroll";
function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const SIDE_FILTERS: Array<{ id: SideId | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "public", label: "Public" },
  { id: "friends", label: "Friends" },
  { id: "close", label: "Close" },
  { id: "work", label: "Work" },
];

const COLOR_OPTIONS: SetColor[] = ["orange", "purple", "blue", "emerald", "rose", "slate"];

function normalizeHandle(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (t.startsWith("@")) return t;
  return `@${t.replace(/^@+/, "")}`;
}

function parseMembers(raw: string): string[] {
  const parts = (raw || "")
    .split(/[\n,]+/g)
    .map((s) => normalizeHandle(s))
    .filter(Boolean);

  // Preserve order, remove duplicates
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function SiddesSetsPageInner() {
  // sd_464c: restore scroll when returning to Sets list
  useReturnScrollRestore();
  const sp = useSearchParams();
  const router = useRouter();

  // sd_465d1: prefetch Set hub route on intent (hover/touch) for instant open feel
  const prefetchSetHub = (id: string) => {
    try {
      router.prefetch(`/siddes-sets/${encodeURIComponent(id)}`);
    } catch {
      // ignore
    }
  };
  const setsProvider = useMemo(() => getSetsProvider(), []);

  // sd_256: Sets UI is session-auth only (no viewer cookie gating).
  const canWrite = true;

  const [sideFilter, setSideFilter] = useState<SideId | "all">("all");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<SetDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newSide, setNewSide] = useState<SideId>("friends");
  const [newColor, setNewColor] = useState<SetColor>("emerald");
  const [newMembersRaw, setNewMembersRaw] = useState("");
  const [creating, setCreating] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (sp.get("create") === "1") setCreateOpen(true);
  }, [sp]);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const opts = sideFilter === "all" ? undefined : { side: sideFilter };
      const got = await setsProvider.list(opts);
      setItems(got);
    } catch (e: any) {
      setErr(e?.message || "Failed to load Sets.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideFilter]);

  useEffect(() => {
    // When membership changes (e.g. invite accept), refresh the list.
    return onSetsChanged(() => {
      void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideFilter]);


  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;

    return items.filter((s) => {
      if (s.label.toLowerCase().includes(t)) return true;
      if (s.id.toLowerCase().includes(t)) return true;
      if (s.members.some((m) => m.toLowerCase().includes(t))) return true;
      if (s.side.toLowerCase().includes(t)) return true;
      return false;
    });
  }, [items, q]);
  const create = async (label: string, membersRaw: string, side: SideId, color?: SetColor) => {
    const clean = (label || "").trim();
    if (!clean) return;
    setCreating(true);
    setErr(null);
    try {
      const created = await setsProvider.create({
        label: clean,
        side,
        members: parseMembers(membersRaw),
        color,
      });

      // Optimistic insert (then refresh to keep ordering consistent)
      setItems((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
      setNewLabel("");
      setNewMembersRaw("");

      // If we're filtering by a different side, refresh list to avoid confusion.
      if (sideFilter !== "all" && created.side !== sideFilter) {
        await refresh();
      }

      return created;
    } catch (e: any) {
      const msg = e?.message || "Create failed.";
      setErr(msg);
      throw new Error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-4">
<div className="flex items-center justify-between md:justify-end gap-3 mb-3">
          <div className="md:hidden">
            <div className="text-sm font-extrabold text-gray-900">Sets</div>
            <div className="text-xs text-gray-500">
              Sets inside a Side.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 flex items-center gap-2"
              aria-label="Refresh"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>

            {process.env.NODE_ENV !== "production" ? (
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setImportOpen(true)}
              className={cn(
                "px-3 py-2 rounded-full border font-bold text-sm flex items-center gap-2",
                !canWrite
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
              aria-label="Import"
            >
              <DownloadCloud size={16} />
              Import
            </button>            ) : null}

          </div>
        </div>
        {err ? (
          <div className="mb-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
            <div className="font-bold">Error</div>
            <div className="text-xs mt-1">{err}</div>
          </div>
        ) : null}

        <SuggestedSetsTray onCreated={() => void refresh()} />

        {canWrite ? (
          <div className="mb-3 p-3 rounded-2xl bg-white border border-gray-200">
            <div className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Plus size={16} />
              Create a Set
            </div>
            <div className="text-xs text-gray-600 leading-relaxed">
              Guided flow: <span className="font-semibold">Name → Side → Theme → Members → Create</span>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={!canWrite}
              className={cn(
                "mt-3 w-full py-2.5 rounded-xl font-bold text-sm border flex items-center justify-center gap-2",
                !canWrite
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
              )}
            >
              <Plus size={16} />
              Start guided creator
            </button>
          </div>
        ) : null}


        {/* Final Polish (5): Sets list */}
        <div className="mb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sets or people"
              className="w-full pl-9 pr-3 py-2 rounded-full bg-white border border-gray-200 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              aria-label="Search Sets"
            />
          </div>

          <div className="mt-2 flex items-center gap-2 overflow-x-auto">
            {SIDE_FILTERS.map((f) => {
              const selected = sideFilter === f.id;
              const theme = f.id !== "all" ? SIDE_THEMES[f.id] : null;

              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSideFilter(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-black border whitespace-nowrap",
                    selected
                      ? theme
                        ? cn(theme.lightBg, theme.text, theme.border)
                        : "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                  aria-label={`Filter: ${f.label}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="p-4 rounded-2xl bg-white border border-gray-200 text-sm text-gray-500">
              Loading Sets…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white border border-gray-200">
              <div className="font-extrabold text-gray-900">No Sets yet</div>
              <div className="text-sm text-gray-600 mt-1">
                Create a Set to group people inside a Side, or import from contacts.
              </div>
              {q.trim() ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="mt-3 px-3 py-2 rounded-full bg-gray-900 text-white font-bold text-sm"
                >
                  Clear search
                </button>
              ) : null}
            </div>
          ) : (
            filtered.map((s) => {
              const theme = SIDE_THEMES[s.side];
              const pill = getSetTheme(s.color);
              const membersCount = Array.isArray(s.members) ? s.members.length : 0;
              const shown = (s.members || []).slice(0, 3);
              const extra = Math.max(0, membersCount - shown.length);

              return (
                <Link key={s.id} href={`/siddes-sets/${encodeURIComponent(s.id)}`} onMouseEnter={() => prefetchSetHub(s.id)} onTouchStart={() => prefetchSetHub(s.id)} className="block">
                  <div
                    className={cn(
                      "p-3 rounded-2xl bg-white border border-gray-200 transition-colors",
                      theme.hoverBg
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={cn("px-2 py-0.5 rounded-full text-[11px] font-black border", pill.bg, pill.text, pill.border)}>
                            {s.color}
                          </div>
                          <div className={cn("px-2 py-0.5 rounded-full text-[11px] font-black border", theme.lightBg, theme.text, theme.border)}>
                            {SIDES[s.side].label}
                          </div>
                          <div className="text-[11px] text-gray-500 font-semibold">
                            {membersCount} member{membersCount === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div className="mt-1 font-extrabold text-gray-900 truncate">{s.label}</div>

                        {shown.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {shown.map((m) => (
                              <span key={m} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">
                                {m}
                              </span>
                            ))}
                            {extra ? (
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">+{extra}</span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-gray-500">No members yet.</div>
                        )}
                      </div>

                      <div className="text-[10px] font-mono text-gray-400 shrink-0">{s.id}</div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div><CreateSetSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        canWrite={canWrite}
        creating={creating}
        err={err}
        label={newLabel}
        setLabel={setNewLabel}
        side={newSide}
        setSide={setNewSide}
        color={newColor}
        setColor={setNewColor}
        membersRaw={newMembersRaw}
        setMembersRaw={setNewMembersRaw}
        onCreate={create} /><ImportSetSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onFinish={({ name, members }) => {
          void create(name, members.join(", "), newSide, newColor).catch(() => { });
        } }
        onCreateSuggested={({ label, color, members, side }) => {
          void create(label, members.join(", "), (side || newSide), color as any).catch(() => { });
        } } /></>
  );
}

export default function SiddesSetsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-gray-500">
          Loading Sets...
        </div>
      }
    >
      <SiddesSetsPageInner />
    </Suspense>
  );
}
