"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ExportPage() {
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
      const me = await meRes?.json().catch(() => ({} as any));
      if (!me?.authenticated) {
        const next = encodeURIComponent("/siddes-profile/account/export");
        window.location.href = `/login?next=${next}`;
        return;
      }
      setAuthed(true);
    })();
  }, []);

  async function download() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/export?limit=1000", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMsg(data?.error ? String(data.error) : "Export failed");
        setBusy(false);
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `siddes_export_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg("Download started.");
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">Export</div>
            <div className="text-xs text-gray-500 mt-1">Download your data</div>
          </div>
          <Link
            href="/siddes-profile/account"
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-700 font-semibold">
            This downloads a JSON export (profile, sets, posts, replies, blocks, reports).
          </div>

          {msg ? <div className="mt-2 text-sm text-gray-700 font-semibold">{msg}</div> : null}

          <button
            type="button"
            onClick={download}
            disabled={!authed || busy}
            className="mt-4 w-full rounded-full py-3 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-60"
          >
            {busy ? "Preparing…" : "Download export"}
          </button>
        </div>
      </div>
    </div>
  );
}
