"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type SessionRow = {
  id: number;
  current: boolean;
  createdAt?: string | null;
  lastSeenAt?: string | null;
  ip: string;
  userAgent: string;
  revokedAt?: string | null;
};

function fmt(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function AccountSessionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const activeRows = useMemo(() => rows.filter((r) => !r.revokedAt), [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await meRes.json().catch(() => ({} as any));
      if (!me?.authenticated) {
        const next = encodeURIComponent("/siddes-profile/account/sessions");
        router.replace(`/login?next=${next}`);
        return;
      }

      const res = await fetch("/api/auth/sessions", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setRows((data.sessions || []) as SessionRow[]);
      } else {
        setMsg(data?.error ? String(data.error) : `http_${res.status}`);
      }
    } catch {
      setMsg("network");
    } finally {
      setLoading(false);
    }
  
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(id: number, isCurrent: boolean) {
    if (busy) return;
    const ok = window.confirm(
      isCurrent
        ? "Revoke THIS session? You will be logged out."
        : "Revoke this session? That device will be logged out."
    );
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/sessions/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        if (data?.loggedOut) {
          router.replace("/login");
          return;
        }
        setMsg("Session revoked.");
        await load();
      } else {
        setMsg(data?.error ? String(data.error) : `http_${res.status}`);
      }
    } catch {
      setMsg("network");
    } finally {
      setBusy(false);
    }
  }

  async function logoutOthers() {
    if (busy) return;
    const ok = window.confirm("Log out other devices? Your current session stays signed in.");
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/sessions/logout_all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ includeCurrent: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setMsg(`Logged out other devices. revoked=${data.revoked} scannedDeleted=${data.scannedDeleted}`);
        await load();
      } else {
        setMsg(data?.error ? String(data.error) : `http_${res.status}`);
      }
    } catch {
      setMsg("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">Devices & Sessions</div>
            <div className="text-xs text-gray-500 mt-1">See where your account is signed in</div>
          </div>
          <Link
            href="/siddes-profile/account"
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-gray-900">Active sessions</div>
            <button
              type="button"
              onClick={logoutOthers}
              disabled={busy || loading || activeRows.length <= 1}
              className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
            >
              {busy ? "Working…" : "Log out other devices"}
            </button>
          </div>

          {msg ? <div className="mt-2 text-sm text-gray-700 font-semibold">{msg}</div> : null}

          {loading ? (
            <div className="mt-3 text-sm text-gray-500">Loading…</div>
          ) : activeRows.length === 0 ? (
            <div className="mt-3 text-sm text-gray-500">No sessions found yet. Use the app, then refresh.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {activeRows.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-gray-900 truncate">{r.userAgent || "Unknown device"}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        IP: <span className="font-semibold text-gray-700">{r.ip || "—"}</span>
                        {" · "}Last seen: <span className="font-semibold text-gray-700">{fmt(r.lastSeenAt)}</span>
                        {" · "}Created: <span className="font-semibold text-gray-700">{fmt(r.createdAt)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {r.current ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-gray-200 bg-white text-gray-700">
                          This device
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => revoke(r.id, r.current)}
                        disabled={busy}
                        className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
                      >
                        {r.current ? "Revoke" : "Revoke"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 text-xs text-gray-500">
            Tip: If you see a device you don’t recognize, revoke it immediately and change your password.
          </div>
        </div>
      </div>
    </div>
  );
}
