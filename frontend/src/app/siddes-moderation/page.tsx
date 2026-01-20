"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ReportItem = {
  id: number;
  createdAt: string | null;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  status: "open" | "reviewing" | "resolved" | "dismissed" | string;
  requestId?: string;
  targetHidden?: boolean | null;
  targetAuthorId?: string | null;
  targetPreview?: string | null;
};

type ReportsResp = { ok: boolean; items?: ReportItem[]; error?: string };

type PatchResp = { ok: boolean; id?: number; status?: string; error?: string };

type HideResp = { ok: boolean; postId?: string; hidden?: boolean; error?: string };

type UserStateResp = { ok: boolean; state?: string; until?: string | null; viewerId?: string; error?: string };

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const STATUSES: Array<ReportItem["status"]> = ["open", "reviewing", "resolved", "dismissed"];

export default function ModerationPage() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await fetch(`/api/reports/admin${q}`, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as ReportsResp | null;
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
      const res = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = (await res.json().catch(() => null)) as PatchResp | null;
      if (!j || !j.ok) {
        setError(j?.error || `update_failed_${res.status}`);
        return;
      }
      setItems((cur) => cur.map((r) => (r.id === id ? { ...r, status: String(j.status || next) } : r)));
    } catch {
      setError("network");
    }
  };

  const setHidden = async (postId: string, hidden: boolean) => {
    try {
      const res = await fetch(`/api/moderation/posts/${encodeURIComponent(postId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      const j = (await res.json().catch(() => null)) as HideResp | null;
      if (!j || !j.ok) {
        setError(j?.error || `hide_failed_${res.status}`);
        return;
      }
      setItems((cur) =>
        cur.map((r) => (r.targetType === "post" && r.targetId === postId ? { ...r, targetHidden: !!j.hidden } : r))
      );
    } catch {
      setError("network");
    }
  };

  const setUserState = async (target: string, state: string, minutes?: number) => {
    try {
      const reason = window.prompt("Reason (optional)") || "";
      const res = await fetch(`/api/moderation/users/state`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, state, minutes, reason }),
      });
      const j = (await res.json().catch(() => null)) as UserStateResp | null;
      if (!j || !j.ok) {
        setError(j?.error || `user_state_failed_${res.status}`);
        return;
      }
      setError(null);
    } catch {
      setError("network");
    }
  };


  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <div className="text-sm font-bold text-gray-900">Moderation</div>
        <div className="text-xs text-gray-500 mt-1">Staff-only triage for user reports.</div>
        <div className="text-xs text-gray-500 mt-1">
          <Link href="/siddes-moderation/audit" className="underline font-bold">Audit log</Link>
          <span className="mx-2">•</span>
          <Link href="/siddes-moderation/stats" className="underline font-bold">Stats</Link>
          <span className="mx-2">•</span>
          <Link href="/siddes-moderation/appeals" className="underline font-bold">Appeals</Link>
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
        <a
          href={`/api/reports/admin/export?status=${encodeURIComponent(statusFilter)}&format=csv&limit=10000`}
          className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
        >
          Export CSV
        </a>
        <a
          href={`/api/reports/admin/export?status=${encodeURIComponent(statusFilter)}&format=json&limit=10000`}
          className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
        >
          Export JSON
        </a>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error === "forbidden" ? "Not authorized." : `Error: ${error}`}</div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-gray-600">No reports in this bucket.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((r) => {
            const isPost = r.targetType === "post";
            const hidden = !!r.targetHidden;
            const userToken = String((r.targetType === "user" ? r.targetId : (r.targetAuthorId || "")) || "");
            return (
              <div key={r.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">
                      #{r.id} • {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                    </div>
                    <div className="text-sm font-bold text-gray-900 mt-1">
                      {r.targetType.toUpperCase()} • {r.reason}
                    </div>
                    {r.details ? <div className="text-xs text-gray-700 mt-1">{r.details}</div> : null}
                    {isPost && r.targetPreview ? (
                      <div className="mt-2 text-xs text-gray-700 border border-gray-100 rounded-xl p-2 bg-gray-50">
                        {r.targetPreview}
                      </div>
                    ) : null}
                    <div className="text-xs text-gray-500 mt-2">
                      Reporter: <span className="font-mono">{r.reporterId}</span>
                      {r.targetAuthorId ? (
                        <>
                          {" "}• Target author: <span className="font-mono">{r.targetAuthorId}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <div className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                      {String(r.status).toUpperCase()}
                    </div>
                    {isPost ? (
                      <Link
                        href={`/siddes-post/${encodeURIComponent(r.targetId)}`}
                        className="text-xs font-extrabold text-slate-700 hover:underline"
                      >
                        Open post
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "reviewing")}
                    className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                  >
                    Reviewing
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "resolved")}
                    className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "dismissed")}
                    className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                  >
                    Dismiss
                  </button>

                  {isPost ? (
                    <button
                      type="button"
                      onClick={() => setHidden(r.targetId, !hidden)}
                      className={cn(
                        "ml-auto text-xs font-extrabold px-3 py-2 rounded-xl border",
                        hidden
                          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                      )}
                    >
                      {hidden ? "Unhide" : "Hide"}
                    </button>
                  ) : null}
                </div>

                {userToken ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="text-xs font-bold text-gray-700">User actions</div>
                    <button
                      type="button"
                      onClick={() => setUserState(userToken, "read_only", 1440)}
                      className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                    >
                      Read-only 24h
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserState(userToken, "suspended", 10080)}
                      className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                    >
                      Suspend 7d
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserState(userToken, "banned")}
                      className="text-xs font-extrabold px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      Ban
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserState(userToken, "active")}
                      className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                    >
                      Reinstate
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
