"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";

import { getSetsProvider } from "@/src/lib/setsProvider";
import type { SetDef } from "@/src/lib/sets";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import { getSetTheme } from "@/src/lib/setThemes";
import type { SetEvent } from "@/src/lib/setEvents";

import { getInviteProvider, type SetInvite } from "@/src/lib/inviteProvider";
import { suggestInviteHandles } from "@/src/lib/inviteSuggestions";
import { InviteActionSheet } from "@/src/components/Invites/InviteActionSheet";
import { InviteList } from "@/src/components/Invites/InviteList";
import { SetsJoinedBanner, SetsJoinedPill } from "@/src/components/SetsJoinedBanner";
import { getStubViewerCookie, isStubMe } from "@/src/lib/stubViewerClient";
import { onSetsChanged } from "@/src/lib/setsSignals";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

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

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function fmt(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function kindLabel(k: SetEvent["kind"]) {
  switch (k) {
    case "created":
      return "Created";
    case "renamed":
      return "Renamed";
    case "members_updated":
      return "Members updated";
    case "moved_side":
      return "Moved Side";
    case "recolored":
      return "Recolored";
    default:
      return k;
  }
}

function kindDetail(e: SetEvent): string {
  const d: any = e.data || {};
  if (e.kind === "renamed") return `${d.from ?? "?"} → ${d.to ?? "?"}`;
  if (e.kind === "members_updated") {
    const from = Array.isArray(d.from) ? d.from.length : "?";
    const to = Array.isArray(d.to) ? d.to.length : "?";
    return `${from} → ${to}`;
  }
  if (e.kind === "moved_side") return `${d.from ?? "?"} → ${d.to ?? "?"}`;
  if (e.kind === "recolored") return `${d.from ?? "?"} → ${d.to ?? "?"}`;
  return "";
}

export default function SiddesSetDetailPage({ params }: { params: { id: string } }) {
  const setId = decodeURIComponent(params.id || "");
  const setsProvider = useMemo(() => getSetsProvider(), []);
  const invitesProvider = useMemo(() => getInviteProvider(), []);
  const providerName = setsProvider.name;

  const [viewer, setViewer] = useState<string | null>(() => getStubViewerCookie() || null);
  useEffect(() => {
    setViewer(getStubViewerCookie() || null);
  }, []);

  const canWrite = providerName !== "backend_stub" || isStubMe(viewer);
  const readOnly = providerName === "backend_stub" && Boolean(viewer) && !isStubMe(viewer);

  const [item, setItem] = useState<SetDef | null>(null);
  const [events, setEvents] = useState<SetEvent[]>([]);
  const [outInvites, setOutInvites] = useState<SetInvite[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [prefillTo, setPrefillTo] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<SetInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [side, setSide] = useState<SideId>("friends");
  const [color, setColor] = useState<SetColor>("emerald");
  const [membersRaw, setMembersRaw] = useState("");

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const got = await setsProvider.get(setId);
      setItem(got);

      if (got) {
        setLabel(got.label);
        setSide(got.side);
        setColor(got.color);
        setMembersRaw(got.members.join(", "));
      }

      const evts = await setsProvider.events(setId);
      setEvents(evts);

      // Outgoing invites for this Set (best-effort; stubs are default-safe).
      try {
        const inv = await invitesProvider.list({ direction: "outgoing" });
        setOutInvites(inv.filter((x) => x.setId === setId));
      } catch {
        setOutInvites([]);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load Set.");
      setItem(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  useEffect(() => {
    // When membership changes (invite accepted), refresh this Set.
    return onSetsChanged(() => {
      void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);


  const showViewerHint = React.useMemo(() => {
    if (providerName !== "backend_stub") return false;
    const hasCookie = typeof document !== "undefined" && document.cookie.includes("sd_viewer=");
    return !hasCookie;
  }, [providerName]);

  const save = async () => {
    if (!item) return;

    if (!canWrite) {
      setErr("Read-only: switch sd_viewer=me to edit this Set.");
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const patch = {
        label: (label || "").trim(),
        side,
        color,
        members: parseMembers(membersRaw),
      };

      const updated = await setsProvider.update(item.id, patch);
      if (!updated) {
        setErr("Set not found.");
        return;
      }

      setItem(updated);
      setLabel(updated.label);
      setSide(updated.side);
      setColor(updated.color);
      setMembersRaw(updated.members.join(", "));

      const evts = await setsProvider.events(updated.id);
      setEvents(evts);
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const pill = item ? getSetTheme(item.color) : getSetTheme(color);
  const sideTheme = SIDE_THEMES[side];
  const membersCount = item ? item.members.length : parseMembers(membersRaw).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Link href="/siddes-sets" className="text-sm font-bold text-gray-700 hover:underline">
            ← Sets
          </Link>
          <Link href="/siddes-feed" className="text-sm font-bold text-gray-700 hover:underline">
            Feed
          </Link>
        </div>

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-500 mb-1">
              provider: <span className="font-mono">{providerName}</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 truncate">{item ? item.label : "Set"}</h1>
            <div className="text-[11px] text-gray-400 font-mono truncate">{setId}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>

            <button
              type="button"
              disabled={saving || !item || !canWrite}
              onClick={() => void save()}
              className={cn(
                "px-3 py-2 rounded-full border font-bold text-sm flex items-center gap-2",
                saving || !item || !canWrite
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
              )}
            >
              <Save size={16} />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {showViewerHint ? (
          <div className="mb-3 p-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
            <div className="font-bold mb-1">backend_stub is ON but sd_viewer is missing.</div>
            <div className="text-xs leading-relaxed">
              Stub APIs are default-safe and return restricted results without a viewer cookie/header.
              <span className="block mt-2 font-mono">
                document.cookie = "sd_viewer=me; Path=/; SameSite=Lax";
              </span>
            </div>
          </div>
        ) : null}

        {readOnly ? (
          <>
            <SetsJoinedBanner viewer={viewer || ""} />
            <div className="mb-3 text-xs text-slate-500">
              Joined as <span className="font-mono">{viewer}</span>
            </div>
          </>
        ) : null}

        {err ? (
          <div className="mb-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
            <div className="font-bold">Error</div>
            <div className="text-xs mt-1">{err}</div>
          </div>
        ) : null}

        <div className="p-4 rounded-2xl bg-white border border-gray-200 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <div className={cn("px-2 py-0.5 rounded-full text-xs font-black border", pill.bg, pill.text, pill.border)}>
              {color}
            </div>
            <div className={cn("px-2 py-0.5 rounded-full text-xs font-black border", sideTheme.lightBg, sideTheme.text, sideTheme.border)}>
              {SIDES[side].label}
            </div>
            {readOnly ? <SetsJoinedPill /> : null}
            {loading ? <div className="text-xs text-gray-400 font-bold">Loading…</div> : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <div className="sm:col-span-2">
              <div className="text-xs font-bold text-gray-700 mb-1">Label</div>
              <input
                value={label}
                readOnly={!canWrite}
                onChange={(e) => setLabel(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10",
                  !canWrite && "bg-gray-50 text-gray-600"
                )}
                placeholder="Set name"
              />
            </div>

            <div>
              <div className="text-xs font-bold text-gray-700 mb-1">Side</div>
              <select
                value={side}
                disabled={!canWrite}
                onChange={(e) => setSide(e.target.value as SideId)}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10",
                  !canWrite && "bg-gray-50 text-gray-600 cursor-not-allowed"
                )}
              >
                {Object.values(SIDES).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <div>
              <div className="text-xs font-bold text-gray-700 mb-1">Color</div>
              <select
                value={color}
                disabled={!canWrite}
                onChange={(e) => setColor(e.target.value as SetColor)}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10",
                  !canWrite && "bg-gray-50 text-gray-600 cursor-not-allowed"
                )}
              >
                {COLOR_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="text-xs font-bold text-gray-700 mb-1">Members ({membersCount})</div>
              <textarea
                value={membersRaw}
                readOnly={!canWrite}
                onChange={(e) => setMembersRaw(e.target.value)}
                className={cn(
                  "w-full min-h-[84px] px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10",
                  !canWrite && "bg-gray-50 text-gray-600"
                )}
                placeholder="@marc_us, @sara_j"
              />
              <div className="text-[11px] text-gray-400 mt-1">Comma or newline separated. We auto-add “@”.</div>
            </div>
          </div>
        </div>


        <div className="p-4 rounded-2xl bg-white border border-gray-200 mb-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="font-black text-gray-900">Invites</div>
              <div className="text-xs text-gray-500">Invite more people to this Set (stub scaffold)</div>
            </div>
	            <div className="flex items-center gap-2">
	              <Link href="/siddes-invites" className="text-xs font-bold text-gray-700 hover:underline whitespace-nowrap">Inbox</Link>
	              <button
	                type="button"
	                disabled={!item || !canWrite}
	                onClick={() => {
	                  if (!canWrite) return;
	                  setPrefillTo(null);
	                  setInviteOpen(true);
	                }}
	                className={cn(
	                  "px-3 py-2 rounded-full border font-bold text-sm",
	                  !item || !canWrite ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
	                )}
	              >
	                Invite
	              </button>
	            </div>
          </div>

          {item && canWrite ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestInviteHandles(item.side, item.members).slice(0, 6).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setPrefillTo(h);
                    setInviteOpen(true);
                  }}
                  className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-black hover:bg-gray-200"
                >
                  {h}
                </button>
              ))}
            </div>
          ) : item && !canWrite ? (
            <div className="mb-3 text-xs text-gray-500">
              Read-only: only the Set owner can send invites.
            </div>
          ) : null}

          {lastInvite ? (
            <div className="mb-3 p-3 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Latest invite link</div>
              <div className="font-mono text-xs text-gray-900 break-all">/invite/{encodeURIComponent(lastInvite.id)}</div>
            </div>
          ) : null}

          <InviteList items={outInvites} />
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="font-black text-gray-900">History</div>
              <div className="text-xs text-gray-500">Event log for this Set (stub / local history)</div>
            </div>
            <div className="text-xs text-gray-500 font-bold whitespace-nowrap">{events.length} events</div>
          </div>

          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="p-3 rounded-2xl border border-gray-200 bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-gray-900 text-sm">{kindLabel(e.kind)}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{kindDetail(e)}</div>
                  </div>
                  <div className="text-[11px] text-gray-400 text-right whitespace-nowrap">
                    <div className="font-semibold">{fmt(e.ts)}</div>
                    <div className="font-mono">{e.by}</div>
                  </div>
                </div>
              </div>
            ))}

            {!events.length ? (
              <div className="p-6 rounded-2xl border border-dashed border-gray-200 text-center">
                <div className="font-black text-gray-900 mb-1">No events yet</div>
                <div className="text-sm text-gray-500">
                  {canWrite ? "Create or edit the Set to generate history." : "History is generated when the owner edits this Set."}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <InviteActionSheet
          open={inviteOpen}
          onClose={() => {
            setInviteOpen(false);
            setPrefillTo(null);
          }}
          setId={setId}
          side={side}
          prefillTo={prefillTo || undefined}
          onCreated={(inv) => {
            setLastInvite(inv);
            setOutInvites((prev) => [inv, ...prev.filter((x) => x.id !== inv.id)].filter((x) => x.setId === setId));
          }}
        />
      </div>
    </div>
  );
}
