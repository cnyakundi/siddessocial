"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AuditItem = {
  id: number;
  createdAt: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorHandle?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  requestId?: string;
  meta?: any;
};

type AuditResp = { ok: boolean; items?: AuditItem[]; error?: string };

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const ACTIONS = ["", "report_status", "post_hide", "post_unhide"];

export default function ModerationAuditPage() {
  const [action, setAction] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const u = new URL("/api/moderation/audit", window.location.origin);
      u.searchParams.set("limit", "200");
      if (action) u.searchParams.set("action", action);
      const res = await fetch(u.toString(), { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as AuditResp | null;
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
  }, [action]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [items]);

  return (
    <div className="px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900">Moderation Audit</div>
          <div className="text-xs text-gray-500 mt-1">Staff-only receipts for moderation actions.</div>
        </div>
        <Link
          href="/siddes-moderation"
          className={cn(
            "ml-auto text-xs font-extrabold px-3 py-2 rounded-xl",
            "border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
          )}
        >
          Back to reports
        </Link>
      </div>
      <div className="mt-3 text-[11px] text-gray-500">
        Retention: run <span className="font-mono">python manage.py purge_moderation_data --dry-run</span> in production ops.
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="text-xs font-bold text-gray-700">Action</div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white"
        >
          {ACTIONS.map((a) => (
            <option key={a || "all"} value={a}>
              {a ? a.toUpperCase() : "ALL"}
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
          href={`/api/moderation/audit/export?format=csv&limit=10000${action ? `&action=${encodeURIComponent(action)}` : ""}`}
          className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
        >
          Export CSV
        </a>
        <a
          href={`/api/moderation/audit/export?format=json&limit=10000${action ? `&action=${encodeURIComponent(action)}` : ""}`}
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
        <div className="text-sm text-gray-600">No audit events.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((e) => {
            const who = e.actorHandle || e.actorName || e.actorId || "Unknown";
            return (
              <div key={e.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">
                      #{e.id} • {e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}
                    </div>
                    <div className="text-sm font-bold text-gray-900 mt-1">{e.action}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-bold">Actor:</span> {who}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-bold">Target:</span> {e.targetType} • {e.targetId}
                    </div>
                    {e.requestId ? (
                      <div className="text-[11px] text-gray-500 mt-1">req: {e.requestId}</div>
                    ) : null}
                    {e.meta && Object.keys(e.meta || {}).length ? (
                      <pre className="mt-2 text-[11px] text-gray-700 whitespace-pre-wrap break-words bg-gray-50 border border-gray-100 rounded-xl p-2">
                        {JSON.stringify(e.meta, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
