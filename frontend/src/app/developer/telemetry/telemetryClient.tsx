"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TelemetrySummary = {
  ok?: boolean;
  days?: number;
  counts?: Record<string, number>;
  error?: string;
};

type MeResp = {
  ok: boolean;
  authenticated?: boolean;
  user?: { id: number; username: string; email: string };
  viewerId?: string;
};

function pct(n: number, d: number): string {
  if (!d) return "0%";
  const v = Math.max(0, Math.min(1, n / d));
  return `${Math.round(v * 100)}%`;
}

export default function TelemetryClient() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TelemetrySummary | null>(null);

  const counts = data?.counts || {};
  const shown = counts["suggestion_shown"] || 0;
  const accepted = counts["suggestion_accepted"] || 0;
  const skipped = counts["suggestion_skipped"] || 0;
  const edited = counts["suggestion_edited"] || 0;
  const undo = counts["suggestion_undo"] || 0;

  const acceptRate = useMemo(() => pct(accepted, shown), [accepted, shown]);
  const skipRate = useMemo(() => pct(skipped, shown), [skipped, shown]);
  const editRate = useMemo(() => pct(edited, Math.max(1, accepted + skipped)), [edited, accepted, skipped]);
  const undoRate = useMemo(() => pct(undo, Math.max(1, accepted)), [undo, accepted]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/telemetry?days=${days}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      setData(j);
    } catch (e) {
      setData({ ok: false, error: "network_error" } as any);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d))
      .catch(() => setMe({ ok: true, authenticated: false } as any));
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const authed = !!me?.authenticated;

  return (
    <div className="min-h-[80vh] px-4 py-10 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-black text-gray-900">Telemetry</div>
            <div className="text-sm text-gray-500 mt-1">
              Counts-only (no handles, no contact identifiers). Useful for suggestion quality.
            </div>
          </div>
          <Link
            href="/developer"
            className="px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Developer
          </Link>
        </div>

        {!authed ? (
          <div className="mt-6 p-6 rounded-2xl border border-gray-200 bg-white">
            <div className="text-lg font-extrabold text-gray-900">Sign in first</div>
            <div className="text-sm text-gray-500 mt-1">Telemetry is tied to your viewer id.</div>
            <Link
              href="/login"
              className="inline-block mt-4 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
            >
              Go to login
            </Link>
          </div>
        ) : null}

        <div className="mt-6 p-6 rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-bold text-gray-900">
              Window: last <span className="font-black">{days}</span> day{days === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDays(7)}
                className={
                  "px-3 py-2 rounded-full text-xs font-extrabold border " +
                  (days === 7 ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
                }
              >
                7d
              </button>
              <button
                type="button"
                onClick={() => setDays(30)}
                className={
                  "px-3 py-2 rounded-full text-xs font-extrabold border " +
                  (days === 30 ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
                }
              >
                30d
              </button>
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="px-4 py-2 rounded-full bg-gray-100 border border-gray-200 text-xs font-extrabold text-gray-800 hover:bg-gray-200 disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500 font-bold">Shown</div>
              <div className="text-xl font-black text-gray-900">{shown}</div>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500 font-bold">Accepted</div>
              <div className="text-xl font-black text-gray-900">{accepted}</div>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500 font-bold">Skipped</div>
              <div className="text-xl font-black text-gray-900">{skipped}</div>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500 font-bold">Edited</div>
              <div className="text-xl font-black text-gray-900">{edited}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-gray-200 bg-white">
              <div className="text-xs text-gray-500 font-bold">Accept rate</div>
              <div className="text-lg font-extrabold text-gray-900">{acceptRate}</div>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 bg-white">
              <div className="text-xs text-gray-500 font-bold">Skip rate</div>
              <div className="text-lg font-extrabold text-gray-900">{skipRate}</div>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 bg-white">
              <div className="text-xs text-gray-500 font-bold">Edit rate</div>
              <div className="text-lg font-extrabold text-gray-900">{editRate}</div>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 bg-white">
              <div className="text-xs text-gray-500 font-bold">Undo rate</div>
              <div className="text-lg font-extrabold text-gray-900">{undoRate}</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-sm font-extrabold text-gray-900">Raw counts</div>
            <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 text-xs font-extrabold text-gray-500">Event</th>
                    <th className="text-right p-3 text-xs font-extrabold text-gray-500">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(counts).length ? (
                    Object.entries(counts)
                      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                      .map(([k, v]) => (
                        <tr key={k} className="border-t border-gray-200">
                          <td className="p-3 font-mono text-xs text-gray-700">{k}</td>
                          <td className="p-3 text-right font-extrabold text-gray-900">{v}</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={2}>
                        {data?.error ? `Error: ${data.error}` : "No events recorded yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Tip: accept/skip/edit Suggested Circles a few times, then hit Refresh. This page never shows handles.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
