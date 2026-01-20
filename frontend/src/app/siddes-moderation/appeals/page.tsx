"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AppealItem = {
  id: number;
  createdAt: string | null;
  appellantId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  status: string;
  staffNote?: string;
  requestId?: string;
};

type AppealsResp = { ok: boolean; items?: AppealItem[]; error?: string };

type PatchResp = { ok: boolean; id?: number; status?: string; error?: string };

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const STATUSES = ["open", "reviewing", "resolved", "dismissed"];

export default function ModerationAppealsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AppealItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await fetch(`/api/appeals/admin${q}`, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as AppealsResp | null;
      if (!j || !j.ok) {
        setError(j?.error || `http_${res.status}`);
        setItems([]);
      } else {
        setItems(Array.isArray(j.items) ? j.items : []);
      }
    } catch {
      setError("network");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [items]);

  const updateStatus = async (id: number, next: string) => {
    try {
      const note = window.prompt("Staff note (optional)") || "";
      const res = await fetch(`/api/appeals/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next, staffNote: note }),
      });
      const j = (await res.json().catch(() => null)) as PatchResp | null;
      if (!j || !j.ok) {
        setError(j?.error || `update_failed_${res.status}`);
        return;
      }
      setItems((cur) => cur.map((a) => (a.id === id ? { ...a, status: String(j.status || next), staffNote: note } : a)));
    } catch {
      setError("network");
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <div className="text-sm font-bold text-gray-900">Appeals</div>
        <div className="text-xs text-gray-500 mt-1">Staff-only review of user appeals.</div>
        <div className="text-xs text-gray-500 mt-1">
          <Link href="/siddes-moderation" className="underline font-bold">
            Reports
          </Link>
          <span className="mx-2">•</span>
          <Link href="/siddes-moderation/audit" className="underline font-bold">
            Audit log
          </Link>
          <span className="mx-2">•</span>
          <Link href="/siddes-moderation/stats" className="underline font-bold">
            Stats
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="text-xs font-bold text-gray-700">Filter</div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {String(s).toUpperCase()}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          className={cn(
            "ml-auto text-xs font-extrabold px-3 py-2 rounded-xl",
            "border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
          )}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading...</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error === "forbidden" ? "Not authorized." : `Error: ${error}`}</div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-gray-600">No appeals in this bucket.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((a) => (
            <div key={a.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">
                    #{a.id} • {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                  </div>
                  <div className="text-sm font-bold text-gray-900 mt-1">
                    {String(a.targetType || "").toUpperCase()} • {a.reason}
                  </div>
                  {a.targetId ? (
                    <div className="text-xs text-gray-600 mt-1">
                      Target: <span className="font-mono">{a.targetId}</span>
                    </div>
                  ) : null}
                  {a.details ? <div className="text-xs text-gray-800 mt-2 whitespace-pre-wrap">{a.details}</div> : null}
                  <div className="text-xs text-gray-500 mt-2">
                    Appellant: <span className="font-mono">{a.appellantId}</span>
                  </div>
                  {a.staffNote ? (
                    <div className="mt-3 text-xs text-gray-700 border border-gray-100 rounded-xl p-2 bg-gray-50">
                      <div className="font-bold text-gray-700">Staff note</div>
                      <div className="mt-1 whitespace-pre-wrap">{a.staffNote}</div>
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <div className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                    {String(a.status || "").toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateStatus(a.id, "reviewing")}
                  className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Reviewing
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(a.id, "resolved")}
                  className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(a.id, "dismissed")}
                  className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
