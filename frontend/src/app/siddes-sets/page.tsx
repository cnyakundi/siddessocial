"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { DownloadCloud, Plus, RefreshCcw, Search } from "lucide-react";

import { ImportSetSheet } from "@/src/components/ImportSetSheet";
import { CreateSetSheet } from "@/src/components/CreateSetSheet";
import { getSetsProvider } from "@/src/lib/setsProvider";
import type { SetDef } from "@/src/lib/sets";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import { SET_THEMES, getSetTheme } from "@/src/lib/setThemes";
import { getStubViewerCookie, isStubMe } from "@/src/lib/stubViewerClient";
import { onSetsChanged } from "@/src/lib/setsSignals";
import { SetsJoinedPill } from "@/src/components/SetsJoinedBanner";

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

export default function SiddesSetsPage() {
  const setsProvider = useMemo(() => getSetsProvider(), []);
  const providerName = setsProvider.name;

  const [viewer, setViewer] = useState<string | null>(() => getStubViewerCookie() || null);
  useEffect(() => {
    // Best-effort: re-read viewer once on mount (helps when cookie is set right before navigation).
    setViewer(getStubViewerCookie() || null);
  }, []);

  const canWrite = providerName !== "backend_stub" || isStubMe(viewer);
  const readOnly = providerName === "backend_stub" && Boolean(viewer) && !isStubMe(viewer);

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

  const showViewerHint = React.useMemo(() => {
    if (providerName !== "backend_stub") return false;
    // If backend_stub is on but viewer cookie isn't set, list will be empty.
    const hasCookie = typeof document !== "undefined" && document.cookie.includes("sd_viewer=");
    return !hasCookie;
  }, [providerName]);

  const create = async (label: string, membersRaw: string, side: SideId, color?: SetColor) => {
    const clean = (label || "").trim();
    if (!clean) return;

    if (!canWrite) {
      const msg = "Create restricted (stub): switch sd_viewer=me";
      setErr(msg);
      throw new Error(msg);
    }

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Link href="/siddes-feed" className="text-sm font-bold text-gray-700 hover:underline">
            ← Feed
          </Link>
          <Link href="/siddes-profile" className="text-sm font-bold text-gray-700 hover:underline">
            Profile
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Sets</h1>
            <div className="text-xs text-gray-500">
              Sets inside a Side • provider: <span className="font-mono">{providerName}</span>
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
          </div>
        </div>

        {showViewerHint ? (
          <div className="mb-3 p-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
            <div className="font-bold mb-1">Heads up: backend_stub is ON but sd_viewer is missing.</div>
            <div className="text-xs leading-relaxed">
              In stub mode, `/api/sets/*` is default-safe and returns empty without a viewer cookie/header.
              <span className="block mt-2 font-mono">
                document.cookie = "sd_viewer=me; Path=/; SameSite=Lax";
              </span>
            </div>
          </div>
        ) : null}

        {readOnly ? (
          <div className="mb-3 p-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm">
            <div className="font-bold mb-1">
              Read-only: you are viewing as <span className="font-mono">{viewer}</span>. • Create disabled (read-only)
            </div>
            <div className="text-xs leading-relaxed text-slate-600">
              In <span className="font-mono">backend_stub</span> mode, only <span className="font-mono">sd_viewer=me</span> can create or edit Sets.
              Switch your viewer cookie, then refresh.
            </div>
          </div>
        ) : null}

        {err ? (
          <div className="mb-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
            <div className="font-bold">Error</div>
            <div className="text-xs mt-1">{err}</div>
          </div>
        ) : null}

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
        </div>
      </div>

<CreateSetSheet
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
  onCreate={create}
/>

      <ImportSetSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onFinish={({ name, members }) => {
          void create(name, members.join(", "), newSide, newColor).catch(() => {});
        }}
        onCreateSuggested={({ label, color, members }) => {
          void create(label, members.join(", "), newSide, color as any).catch(() => {});
        }}
      />
    </div>
  );
}
