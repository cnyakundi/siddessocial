"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { DownloadCloud, Plus, RefreshCcw, Search } from "lucide-react";

import { ImportSetSheet } from "@/src/components/ImportSetSheet";
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
      setErr("Create restricted (stub): switch sd_viewer=me");
      return;
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
    } catch (e: any) {
      setErr(e?.message || "Create failed.");
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
              Rooms inside a Side • provider: <span className="font-mono">{providerName}</span>
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
              Read-only: you are viewing as <span className="font-mono">{viewer}</span>.
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g., Weekend Crew"
              className="sm:col-span-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
            />

            <select
              value={newSide}
              onChange={(e) => setNewSide(e.target.value as SideId)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
              aria-label="Side"
            >
              {Object.values(SIDES).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <select
              value={newColor}
              onChange={(e) => setNewColor(e.target.value as SetColor)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
              aria-label="Color"
            >
              {COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="sm:col-span-2">
              <input
                type="text"
                value={newMembersRaw}
                onChange={(e) => setNewMembersRaw(e.target.value)}
                placeholder="Members: @marc_us, @sara_j"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
              />
              <div className="text-[11px] text-gray-400 mt-1">Comma or newline separated. We auto-add “@”.</div>
            </div>
          </div>

          <button
            type="button"
            disabled={creating || !newLabel.trim()}
            onClick={() => void create(newLabel, newMembersRaw, newSide, newColor)}
            className={cn(
              "w-full py-2.5 rounded-xl font-bold text-sm border flex items-center justify-center gap-2",
              creating || !newLabel.trim()
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
            )}
          >
            <Plus size={16} />
            {creating ? "Creating…" : "Create Set"}
          </button>
          </div>
        ) : (
          <div className="mb-3 p-3 rounded-2xl bg-white border border-gray-200">
            <div className="font-bold text-gray-900 mb-1">Create disabled (read-only)</div>
            <div className="text-sm text-gray-500">
              In <span className="font-mono">backend_stub</span> mode, creating/editing Sets is locked to{" "}
              <span className="font-mono">sd_viewer=me</span>.
            </div>
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          {SIDE_FILTERS.map((f) => {
            const active = sideFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSideFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold border",
                  active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Sets…"
              className="w-full pl-9 pr-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10"
            />
          </div>

          <div className="text-xs text-gray-500 font-semibold whitespace-nowrap">
            {loading ? "Loading…" : `${filtered.length} shown`}
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((s) => {
            const theme = getSetTheme(s.color);
            const sideTheme = SIDE_THEMES[s.side];

            return (
              <Link
                key={s.id}
                href={`/siddes-sets/${encodeURIComponent(s.id)}`}
                className="block p-3 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("px-2 py-0.5 rounded-full text-xs font-black border", theme.bg, theme.text, theme.border)}>
                        {s.label}
                      </div>

                      <div className={cn("px-2 py-0.5 rounded-full text-[11px] font-black border", sideTheme.lightBg, sideTheme.text, sideTheme.border)}>
                        {SIDES[s.side].label}
                      </div>
                      {readOnly ? <SetsJoinedPill /> : null}
                    </div>

                    <div className="text-[12px] text-gray-500">
                      {s.members.length ? (
                        <>
                          {s.members.slice(0, 4).join(", ")}
                          {s.members.length > 4 ? " …" : ""}
                        </>
                      ) : (
                        "No members yet"
                      )}
                    </div>
                  </div>

                  <div className="text-xs font-bold text-gray-500 whitespace-nowrap">
                    {s.members.length} member{s.members.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="font-mono">{s.id}</span>
                  <span className="font-bold">{SET_THEMES[s.color] ? s.color : "color"}</span>
                </div>
              </Link>
            );
          })}

          {!loading && !filtered.length ? (
            <div className="p-8 rounded-2xl border border-dashed border-gray-200 bg-white text-center">
              <div className="font-black text-gray-900 mb-1">No Sets yet</div>
              <div className="text-sm text-gray-500 mb-4">Create one above, or import from contacts.</div>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="px-4 py-2 rounded-full bg-gray-900 text-white font-bold text-sm hover:opacity-95"
              >
                Import from contacts
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ImportSetSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onFinish={({ name, members }) => {
          void create(name, members.join(", "), newSide, newColor);
        }}
        onCreateSuggested={({ label, color, members }) => {
          void create(label, members.join(", "), newSide, color as any);
        }}
      />
    </div>
  );
}
