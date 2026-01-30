"use client";

import Link from "next/link";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronRight, DownloadCloud, Plus, RefreshCcw, Search } from "lucide-react";

import { ImportSetSheet } from "@/src/components/ImportSetSheet";
import { SuggestedSetsTray } from "@/src/components/SuggestedSetsTray";
import { CreateSetSheet } from "@/src/components/CreateSetSheet";
import { SetsJoinedPill } from "@/src/components/SetsJoinedBanner";
import { getSetsProvider } from "@/src/lib/setsProvider";
import type { SetDef } from "@/src/lib/sets";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import { getSetTheme } from "@/src/lib/setThemes";
import { onSetsChanged } from "@/src/lib/setsSignals";
import { getStubViewerCookie, isStubMe } from "@/src/lib/stubViewerClient";
import { useReturnScrollRestore } from "@/src/hooks/returnScroll";
import { usePullToRefresh } from "@/src/hooks/usePullToRefresh";
import { FLAGS } from "@/src/lib/flags";

import { useSide } from "@/src/components/SideProvider";

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

const COLOR_OPTIONS: SetColor[] = ["orange", "purple", "emerald", "rose", "slate"];

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


function initialsFromHandle(raw: string): string {
  const t = String(raw || "").trim().replace(/^@/, "");
  if (!t) return "??";
  return t.slice(0, 2).toUpperCase();
}

function SiddesSetsPageInner() {
  // sd_464c: restore scroll when returning to Groups list
  useReturnScrollRestore();
  const sp = useSearchParams();
  const { side: ctxSide } = useSide();

  // sd_543a: MVP default — keep Groups calm; unlock power tools via ?advanced=1
  const advanced = sp.get("advanced") === "1";
  const activeTheme = SIDE_THEMES[ctxSide];
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

  const viewer = getStubViewerCookie();
  const inStub = Boolean(viewer);
  const isMe = isStubMe(viewer);

  // Writes are allowed unless we are explicitly viewing as a non-owner stub viewer.
  const canWrite = !inStub || isMe;

  const [sideFilter, setSideFilter] = useState<SideId | "all">(ctxSide);

  // sd_468a1: keep sets list scoped to the current Side (Side tabs control context)
  useEffect(() => {
    setSideFilter(ctxSide);
  }, [ctxSide]);

  const [q, setQ] = useState("");

  const [items, setItems] = useState<SetDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newSide, setNewSide] = useState<SideId>(ctxSide);

  useEffect(() => {
    setNewSide(ctxSide);
  }, [ctxSide]);

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
      setErr(e?.message || "Failed to load groups.");
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
  // sd_913_pull_to_refresh_sets: pull-to-refresh Sets list.
  const pullEnabled = Boolean(FLAGS.pullToRefresh);

  const doPullRefresh = async () => {
    if (!pullEnabled) return;
    if (loading || creating) return;
    try {
      if (typeof window !== "undefined" && (window.scrollY || 0) > 8) return;
    } catch {}
    await refresh();
  };

  const { pullY, phase: pullPhase } = usePullToRefresh({
    enabled: pullEnabled,
    refreshing: loading,
    onRefresh: doPullRefresh,
    canStart: () => {
      if (!pullEnabled) return false;
      if (loading || creating) return false;
      if (importOpen || createOpen) return false;
      return true;
    },
  });

  const pullTransition = pullPhase === "pulling" || pullPhase === "armed" ? "none" : "transform 180ms ease-out";
  const pullStyle =
    pullY > 0 || pullPhase === "refreshing"
      ? { transform: `translate3d(0, ${pullY}px, 0)`, transition: pullTransition, willChange: "transform" as const }
      : undefined;



  return (
    <>
      <div className="p-4">
        {err ? (
          <div className="mb-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
            <div className="font-bold">Error</div>
            <div className="text-xs mt-1">{err}</div>
          </div>
        ) : null}

{!canWrite && viewer ? (
  <div className="mb-3 p-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm">
    <div className="flex items-center gap-2 font-bold mb-1">
      <SetsJoinedPill />
      <div className="min-w-0 truncate">
        Read-only: you are viewing as <span className="font-mono">{viewer}</span>
      </div>
    </div>
    <div className="text-xs leading-relaxed text-slate-600">
      <span className="font-bold">Create disabled (read-only)</span> — only the owner can create or edit circles in this view.
    </div>
  </div>
) : null}

        {/* MVP: one obvious action */}
        <div className="flex items-center justify-end gap-2 mb-4">
          {canWrite ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={cn(
                "px-4 py-2.5 rounded-full font-extrabold text-sm text-white shadow-sm active:scale-95 transition-all flex items-center gap-2",
                activeTheme.primaryBg
              )}
              aria-label="New group"
            >
              <Plus size={16} />
              New group
            </button>
          ) : null}

          {/* Power tools stay hidden unless explicitly requested */}
          {advanced ? (
            <>
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
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        
        <div className="text-[11px] text-gray-500 -mt-2 mb-4 text-right">
          Guided flow • Name → Side → Theme → Members → Create
        </div>
        {advanced ? (
          <div className="mb-4">
            <SuggestedSetsTray onCreated={() => void refresh()} />
          </div>
        ) : null}

        {advanced ? (
          <div className="mb-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search groups or people"
                className="w-full pl-9 pr-3 py-2 rounded-full bg-white border border-gray-200 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                aria-label="Search Groups"
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {loading ? (
            <div className="p-4 rounded-2xl bg-white border border-gray-200 text-sm text-gray-500">
              Loading Sets…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-5 rounded-2xl bg-white border border-gray-200">
              <div className="font-extrabold text-gray-900">No groups yet</div>
              <div className="text-sm text-gray-600 mt-1">
                Create a group to group people inside <span className={cn("font-bold", activeTheme.text)}>{SIDES[ctxSide].label}</span>.
              </div>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className={cn(
                    "mt-4 px-4 py-2.5 rounded-full font-extrabold text-sm text-white",
                    activeTheme.primaryBg
                  )}
                >
                  <Plus size={16} className="inline-block mr-2 -mt-0.5" />
                  New group
                </button>
              ) : null}
              {advanced ? (
                <div className="mt-4 text-xs text-gray-400">
                  Tip: remove <span className="font-bold">?advanced=1</span> for MVP mode.
                </div>
              ) : (
                <div className="mt-4 text-xs text-gray-400">
                  Tip: add <span className="font-bold">?advanced=1</span> for import + suggestions.
                </div>
              )}
            </div>
          ) : (
            filtered.map((s) => {
              const theme = SIDE_THEMES[s.side];
              const setTheme = getSetTheme(s.color);
              const membersCount = Array.isArray(s.members) ? s.members.length : 0;

              // Joined vs owner polish (server may provide isOwner; stub mode also implies non-owner)
              const joined = (s as any).isOwner === false || (!!viewer && !isMe && (s as any).isOwner !== true);

              const previewMembers = Array.isArray(s.members) ? s.members.slice(0, 3) : [];
              const extra = membersCount > 3 ? membersCount - 3 : 0;

              return (
                <Link
                  key={s.id}
                  href={"/siddes-sets/" + encodeURIComponent(s.id)}
                  onMouseEnter={() => prefetchSetHub(s.id)}
                  onTouchStart={() => prefetchSetHub(s.id)}
                  className="block"
                >
                  <div
                    className={cn(
                      "p-4 rounded-2xl bg-white border border-gray-200 transition-colors flex items-center justify-between gap-3",
                      theme.hoverBg
                    )}
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <span className={cn("w-3 h-3 rounded-full flex-shrink-0", setTheme.bg)} aria-hidden="true" />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="font-extrabold text-gray-900 truncate">{s.label}</div>
                          {joined ? <SetsJoinedPill className="shrink-0" /> : null}
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-3">
                          <div className="text-xs text-gray-500 font-semibold">
                            {membersCount} member{membersCount === 1 ? "" : "s"}
                          </div>

                          {previewMembers.length ? (
                            <div className="flex -space-x-2">
                              {previewMembers.map((m) => (
                                <div
                                  key={m}
                                  className="w-6 h-6 rounded-full border border-gray-200 bg-white flex items-center justify-center text-[10px] font-black text-gray-600"
                                  title={m}
                                >
                                  {initialsFromHandle(m)}
                                </div>
                              ))}
                              {extra ? (
                                <div className="w-6 h-6 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-500">
                                  +{extra}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {advanced ? (
          <div className="mt-6 text-xs text-gray-400">
            Advanced mode is on. (Remove <span className="font-bold">?advanced=1</span> for MVP mode.)
          </div>
        ) : null}
      </div>
      <CreateSetSheet
        open={createOpen}
        advanced={advanced}
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
        onCreate={create}
      />
      <ImportSetSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onFinish={({ name, members }) => {
          void create(name, members.join(", "), newSide, newColor).catch(() => {});
        }}
        onCreateSuggested={({ label, color, members, side }) => {
          void create(label, members.join(", "), (side || newSide), (color as any)).catch(() => {});
        }}
      />
    </>


  );
}

export default function SiddesSetsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-gray-500">
          Loading groups...
        </div>
      }
    >
      <SiddesSetsPageInner />
    </Suspense>
  );
}
