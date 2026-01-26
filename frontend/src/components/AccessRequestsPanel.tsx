"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, X, UserPlus } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { SIDES, type SideId } from "@/src/lib/sides";

type AccessReqItem = {
  id: string;
  from: { handle: string };
  side: SideId;
  message?: string | null;
  createdAt?: string | null;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function AccessRequestsPanel() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AccessReqItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const count = items.length;

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/access-requests", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok || !j || j.ok !== true) {
        setErr(j?.error || "request_failed");
        setItems([]);
        return;
      }
      const next = Array.isArray(j.items) ? (j.items as any[]) : [];
      setItems(
        next
          .map((r) => ({
            id: String(r?.id || ""),
            from: { handle: String(r?.from?.handle || "").trim() },
            side: (String(r?.side || "friends").trim() as SideId),
            message: r?.message ?? "",
            createdAt: r?.createdAt ?? null,
          }))
          .filter((r) => r.id && r.from.handle)
      );
    } catch {
      setErr("network_error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const respond = async (id: string, action: "accept" | "reject") => {
    if (!id || busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/access-requests/${encodeURIComponent(id)}/respond`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 401 ? "Login required." : res.status === 429 ? "Slow down." : "Could not update.";
        toast.error(msg);
        return;
      }
      const granted = String(j?.grantedSide || "").trim();
      if (action === "accept") {
        toast.success(granted ? `Accepted (${SIDES[granted as SideId]?.label || granted}).` : "Accepted.");
      } else {
        toast.success("Rejected.");
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {
      toast.error("Could not update.");
    } finally {
      setBusyId(null);
    }
  };

  const subtitle = useMemo(() => {
    if (loading) return "Loading…";
    if (err) return "Couldn’t load requests.";
    if (!count) return "No pending requests.";
    return `${count} pending`;
  }, [loading, err, count]);

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black text-gray-900 flex items-center gap-2">
            <UserPlus size={16} className="text-gray-700" />
            Access requests
          </div>
          <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-extrabold text-gray-700"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {err ? <div className="mt-3 text-xs text-rose-600 font-semibold">{err}</div> : null}

      <div className="mt-4 space-y-2">
        {!items.length ? (
          <div className="text-xs text-gray-500">People will show up here when they request Friends/Close/Work access.</div>
        ) : (
          items.map((r) => (
            <div key={r.id} className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-gray-900 truncate">{r.from.handle}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    Requests: <span className="font-black text-gray-900">{SIDES[r.side]?.label || r.side}</span>
                  </div>
                  {r.message ? <div className="text-xs text-gray-500 mt-1">{String(r.message)}</div> : null}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5",
                      "bg-gray-900 text-white hover:opacity-90 disabled:opacity-50"
                    )}
                    disabled={busyId === r.id}
                    onClick={() => void respond(r.id, "accept")}
                    aria-label="Accept"
                  >
                    <Check size={14} />
                    Accept
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5",
                      "bg-white border border-gray-200 text-gray-800 hover:bg-gray-100 disabled:opacity-50"
                    )}
                    disabled={busyId === r.id}
                    onClick={() => void respond(r.id, "reject")}
                    aria-label="Reject"
                  >
                    <X size={14} />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
