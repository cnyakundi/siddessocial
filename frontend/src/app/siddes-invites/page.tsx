"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { Check, RefreshCcw, X } from "lucide-react";

import type { InviteAction, InviteDirection, SetInvite } from "@/src/lib/inviteProvider";
import { getInviteProvider } from "@/src/lib/inviteProvider";
import { getSetsProvider } from "@/src/lib/setsProvider";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function fmt(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function actionLabel(a: InviteAction): string {
  if (a === "accept") return "Accept";
  if (a === "reject") return "Reject";
  return "Revoke";
}

export default function SiddesInvitesPage() {
  const invites = useMemo(() => getInviteProvider(), []);
  const sets = useMemo(() => getSetsProvider(), []);

  const [direction, setDirection] = useState<InviteDirection>("incoming");
  const [items, setItems] = useState<SetInvite[]>([]);
  const [setLabels, setSetLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const hydrateSetLabels = async (list: SetInvite[]) => {
    // Best-effort: resolve labels only for accepted invites.
    // Pending invites should rely on invite.setLabel snapshot.
    const ids = Array.from(
      new Set(
        list
          .filter((inv) => !inv.setLabel)
          .filter((inv) => inv.status === "accepted")
          .map((inv) => inv.setId)
          .filter(Boolean)
      )
    );
    if (!ids.length) return;

    // Skip ids already resolved.
    const missing = ids.filter((id) => !setLabels[id]);
    if (!missing.length) return;

    const pairs = await Promise.all(
      missing.map(async (id) => {
        try {
          const s = await sets.get(id);
          if (s && s.label) return [id, s.label] as const;
        } catch {
          // ignore
        }
        return null;
      })
    );

    const patch: Record<string, string> = {};
    for (const p of pairs) {
      if (p) patch[p[0]] = p[1];
    }
    if (Object.keys(patch).length) {
      setSetLabels((prev) => ({ ...prev, ...patch }));
    }
  };

  const refresh = async (dir?: InviteDirection) => {
    const d = dir || direction;
    setLoading(true);
    setErr(null);
    try {
      const list = await invites.list({ direction: d });
      setItems(list);
      void hydrateSetLabels(list);
    } catch (e: any) {
      setErr(e?.message || "Failed to load invites.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  const doAct = async (inv: SetInvite, action: InviteAction) => {
    setActingId(inv.id);
    setErr(null);
    setBanner(null);
    try {
      const nxt = await invites.act(inv.id, action);
      if (!nxt) {
        setErr("Invite not found.");
        return;
      }
      setItems((prev) => prev.map((x) => (x.id === nxt.id ? nxt : x)));
      void hydrateSetLabels([nxt]);
      setBanner(`${actionLabel(action)} ✓`);
    } catch (e: any) {
      setErr(e?.message || "Action failed.");
    } finally {
      setActingId(null);
    }
  };

  // Without client-side viewer spoofing, we gate actions by the selected view.
  // Server remains the source of truth and will enforce permissions.
  const canAcceptReject = (inv: SetInvite) => direction === "incoming" && inv.status === "pending";
  const canRevoke = (inv: SetInvite) => direction === "outgoing" && inv.status === "pending";

  const tabs: Array<{ id: InviteDirection; label: string }> = [
    { id: "incoming", label: "Incoming" },
    { id: "outgoing", label: "Outgoing" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="md:hidden text-sm font-extrabold text-gray-900">Invites</div>
          <button
            type="button"
            onClick={() => void refresh(direction)}
            className="ml-auto px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>

        {banner ? (
          <div className="mb-3 p-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm flex items-center gap-2">
            <Check size={16} />
            <div className="font-bold">{banner}</div>
          </div>
        ) : null}

        {err ? (
          <div className="mb-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
            <div className="font-bold">Error</div>
            <div className="text-xs mt-1">{err}</div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 mb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDirection(t.id)}
              className={cn(
                "px-3 py-2 rounded-full text-sm font-bold border",
                direction === t.id
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
            >
              {t.label}
            </button>
          ))}
          {loading ? <div className="text-xs text-gray-400 font-bold ml-1">Loading…</div> : null}
        </div>

        {!items.length ? (
          <div className="p-6 rounded-2xl border border-dashed border-gray-200 text-center bg-white">
            <div className="font-black text-gray-900 mb-1">No invites</div>
            <div className="text-sm text-gray-500">
              Incoming invites appear here after someone invites you. Outgoing invites appear after you send.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((inv) => {
              const setLabel = inv.setLabel || setLabels[inv.setId];
              return (
                <div key={inv.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black text-gray-900 text-sm truncate">
                        {inv.from} → {inv.to}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Set:{" "}
                        {setLabel ? (
                          <>
                            <span className="font-black text-gray-900">{setLabel}</span>
                            <span className="ml-1 font-mono text-[11px] text-gray-400">{inv.setId.slice(0, 10)}…</span>
                          </>
                        ) : (
                          <span className="font-mono">{inv.setId}</span>
                        )}
                        {" "}• Side: <span className="font-mono">{inv.side}</span>
                      </div>
                      {inv.message ? <div className="text-xs text-gray-600 mt-2">“{inv.message}”</div> : null}
                      <div className="text-[11px] text-gray-400 mt-2">
                        status: <span className="font-mono">{inv.status}</span> • updated:{" "}
                        <span className="font-mono">{fmt(inv.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {inv.status === "accepted" ? (
                        <Link
                          href={`/siddes-sets/${encodeURIComponent(inv.setId)}`}
                          className="px-3 py-1.5 rounded-full text-xs font-black border bg-gray-900 text-white border-gray-900 hover:opacity-95 whitespace-nowrap"
                        >
                          Open Set
                        </Link>
                      ) : null}

                      <Link
                        href={`/invite/${encodeURIComponent(inv.id)}`}
                        className="text-xs font-bold text-gray-900 hover:underline whitespace-nowrap"
                      >
                        details
                      </Link>

                      <div className="flex items-center gap-2">
                        {canRevoke(inv) ? (
                          <button
                            type="button"
                            disabled={actingId === inv.id}
                            onClick={() => void doAct(inv, "revoke")}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-black border flex items-center gap-1",
                              actingId === inv.id
                                ? "bg-gray-100 text-gray-400 border-gray-200"
                                : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                            )}
                          >
                            <X size={14} />
                            Revoke
                          </button>
                        ) : null}

                        {canAcceptReject(inv) ? (
                          <>
                            <button
                              type="button"
                              disabled={actingId === inv.id}
                              onClick={() => void doAct(inv, "reject")}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-black border",
                                actingId === inv.id
                                  ? "bg-gray-100 text-gray-400 border-gray-200"
                                  : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                              )}
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={actingId === inv.id}
                              onClick={() => void doAct(inv, "accept")}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-black border",
                                actingId === inv.id
                                  ? "bg-gray-100 text-gray-400 border-gray-200"
                                  : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
                              )}
                            >
                              Accept
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-[11px] text-gray-400">
          Tip: If you don’t see expected invites, confirm you’re logged in and that the invite was sent to the right identity.
        </div>
      </div>
    </div>
  );
}
