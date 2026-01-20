"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type BlocksResp = { ok: boolean; blocked?: string[]; error?: string };

export default function BlockedUsersPage() {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => [...blocked].sort((a, b) => a.localeCompare(b)), [blocked]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/blocks", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as BlocksResp | null;
      if (!j || !j.ok) {
        setError(j?.error || "failed");
        setBlocked([]);
      } else {
        setBlocked(Array.isArray(j.blocked) ? j.blocked : []);
      }
    } catch {
      setError("network");
      setBlocked([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUnblock = async (token: string) => {
    const t = String(token || "").trim();
    if (!t) return;
    try {
      await fetch(`/api/blocks/${encodeURIComponent(t)}`, { method: "DELETE" });
    } catch {
      // ignore
    } finally {
      load();
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-gray-900">Blocked users</div>
          <div className="text-xs text-gray-500 mt-1">Blocked users disappear from your feed and threads.</div>
        </div>
        <Link href="/siddes-settings" className="text-xs font-bold text-gray-700 hover:text-gray-900">
          Back
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">Could not load blocks ({error}).</div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-gray-600">You haven’t blocked anyone.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((t) => (
            <div key={t} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-gray-200 bg-white">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-gray-900 truncate">{t}</div>
                <div className="text-xs text-gray-500">Blocked</div>
              </div>
              <button
                type="button"
                onClick={() => onUnblock(t)}
                className={cn(
                  "px-3 py-2 rounded-full text-xs font-extrabold",
                  "border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
                )}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
