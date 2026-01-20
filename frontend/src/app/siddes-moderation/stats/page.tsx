"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type StatsResp = {
  ok: boolean;
  serverTime?: string;
  windowHours?: number;
  totals?: Record<string, number>;
  lastWindow?: Record<string, number>;
  accountStates?: Record<string, number>;
  reportsByStatus?: Record<string, number>;
  auditActions?: Record<string, number>;
  error?: string;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function fmt(n: any) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString();
}

const HOURS = [1, 6, 24, 168];

function KVCard({ title, data }: { title: string; data: Record<string, number> | undefined }) {
  const keys = useMemo(() => Object.keys(data || {}).sort(), [data]);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-sm font-extrabold text-gray-900">{title}</div>
      {keys.length === 0 ? (
        <div className="text-xs text-gray-500 mt-2">No data.</div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {keys.map((k) => (
            <div key={k} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="text-xs font-bold text-gray-600 truncate">{k}</div>
              <div className="text-xs font-black text-gray-900">{fmt((data || {})[k])}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ModerationStatsPage() {
  const [hours, setHours] = useState<number>(24);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResp | null>(null);

  const load = async (h: number) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/moderation/stats?hours=${encodeURIComponent(String(h))}`, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as StatsResp | null;
      if (!j || !j.ok) {
        setErr(j?.error || `http_${res.status}`);
        setStats(null);
      } else {
        setStats(j);
      }
    } catch {
      setErr("network");
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(hours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  const exportCsv = `/api/moderation/stats/export?format=csv&hours=${encodeURIComponent(String(hours))}`;
  const exportJson = `/api/moderation/stats/export?format=json&hours=${encodeURIComponent(String(hours))}`;

  return (
    <div className="px-4 py-6">
      <div className="mb-4 flex items-start gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900">Admin Stats</div>
          <div className="text-xs text-gray-500 mt-1">Staff-only operational snapshot (DB-backed).</div>
          {stats?.serverTime ? (
            <div className="text-[11px] text-gray-500 mt-1">server: {new Date(stats.serverTime).toLocaleString()}</div>
          ) : null}
        </div>
        <Link
          href="/siddes-moderation"
          className={cn(
            "ml-auto text-xs font-extrabold px-3 py-2 rounded-xl",
            "border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
          )}
        >
          Back
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="text-xs font-bold text-gray-700">Window</div>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              Last {h}h
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => load(hours)}
          className={cn(
            "ml-auto text-xs font-extrabold px-3 py-2 rounded-xl",
            "border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
          )}
        >
          Refresh
        </button>
        <a
          href={exportCsv}
          className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
        >
          Export CSV
        </a>
        <a
          href={exportJson}
          className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
        >
          Export JSON
        </a>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : err ? (
        <div className="text-sm text-red-600">{err === "forbidden" ? "Not authorized." : `Error: ${err}`}</div>
      ) : !stats ? (
        <div className="text-sm text-gray-600">No stats.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <KVCard title="Totals" data={stats.totals} />
          <KVCard title={`New in last ${stats.windowHours || hours}h`} data={stats.lastWindow} />
          <KVCard title="Account states" data={stats.accountStates} />
          <KVCard title="Reports by status" data={stats.reportsByStatus} />
          <KVCard title="Moderation actions in window" data={stats.auditActions} />
        </div>
      )}
    </div>
  );
}
