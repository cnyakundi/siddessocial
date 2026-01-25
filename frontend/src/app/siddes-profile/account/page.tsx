"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { clearPrivateClientCaches } from "@/src/lib/privateClientCaches";

type MePayload = {
  ok?: boolean;
  authenticated?: boolean;
  user?: { id: number; username: string; email: string };
  viewerId?: string;
  emailVerified?: boolean;
  onboarding?: { completed: boolean; step: number; contact_sync_done: boolean };
  error?: string;
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-gray-200 bg-gray-50 text-gray-700">
      {children}
    </span>
  );
}

export default function SiddesAccountPage() {
  const [data, setData] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as any;
        if (!mounted) return;
        if (j && typeof j === "object") setData(j);
        else setData({ ok: false, error: "bad_response" });
      } catch {
        if (!mounted) return;
        setData({ ok: false, error: "network_error" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function doLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    // Paranoia: clear private client caches before leaving the session.
    clearPrivateClientCaches();
    window.location.href = "/login";
  }

  const authed = !!data?.authenticated;
  const onboarded = !!data?.onboarding?.completed;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">Account</div>
            <div className="text-xs text-gray-500 mt-1">Session & onboarding</div>
          </div>

          <button
            type="button"
            onClick={doLogout}
            disabled={busy}
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
          >
            {busy ? "Logging out…" : "Log out"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/siddes-profile"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Prism Identity</div>
            <div className="text-xs text-gray-500 mt-1">How you appear in each Side</div>
          </Link><Link
  href="/siddes-profile/account/signin-methods"
  className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
>
  <div className="text-sm font-extrabold text-gray-900">Sign-in methods</div>
  <div className="text-xs text-gray-500 mt-1">Passkeys, Apple, Google, phone</div>
</Link>

          <Link
            href="/siddes-profile/account/password"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Password</div>
            <div className="text-xs text-gray-500 mt-1">Change or set a password</div>
          </Link>

          <Link
            href="/siddes-profile/account/email"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Email</div>
            <div className="text-xs text-gray-500 mt-1">Change your email</div>
          </Link>

          <Link
            href="/siddes-profile/account/export"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Export</div>
            <div className="text-xs text-gray-500 mt-1">Download your data</div>
          </Link>

          <Link
            href="/siddes-profile/siders"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Access list</div>
            <div className="text-xs text-gray-500 mt-1">Who can see you in Friends / Close / Work</div>
          </Link>


          <Link
            href="/siddes-profile/account/danger"
            className="rounded-2xl border border-rose-200 bg-white hover:bg-rose-50 p-4"
          >
            <div className="text-sm font-extrabold text-rose-700">Danger zone</div>
            <div className="text-xs text-gray-500 mt-1">Deactivate or delete</div>
          </Link>




          <Link
            href="/siddes-profile/account/sessions"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Devices & Sessions</div>
            <div className="text-xs text-gray-500 mt-1">Log out other devices</div>
          </Link>


        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading account…</div>
          ) : !authed ? (
            <div>
              <div className="text-sm font-bold text-gray-900">Not signed in</div>
              <div className="text-xs text-gray-500 mt-1">
                Your session is missing or expired.
              </div>
              <div className="mt-3">
                <Link
                  href="/login"
                  className="inline-flex px-3 py-2 rounded-xl text-sm font-extrabold bg-gray-900 text-white"
                >
                  Go to Login
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>viewer: {data?.viewerId || "(missing)"}</Badge>
                {onboarded ? <Badge>onboarding: complete</Badge> : <Badge>onboarding: not complete</Badge>}
                {data?.onboarding?.contact_sync_done ? <Badge>contacts: synced</Badge> : <Badge>contacts: not yet</Badge>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">Username</div>
                  <div className="text-sm font-bold text-gray-900 mt-1">{data?.user?.username || "—"}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">Email</div>
                  <div className="text-sm font-bold text-gray-900 mt-1">{data?.user?.email || "—"}</div>
                </div>
              </div>

              {!onboarded ? (
                <div className="mt-1 text-xs text-gray-500">
                  You can finish onboarding any time.
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/siddes-inbox?tab=alerts"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Alerts</div>
            <div className="text-xs text-gray-500 mt-1">Mentions, replies, invites</div>
          </Link>

          <Link
            href="/siddes-invites"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Invites</div>
            <div className="text-xs text-gray-500 mt-1">Pending + accepted</div>
          </Link>

          <Link
            href="/siddes-sets"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Sets</div>
            <div className="text-xs text-gray-500 mt-1">Groups inside each Side</div>
          </Link>
          {!onboarded ? (
            <Link
              href="/onboarding"
              className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4 sm:col-span-2"
            >
              <div className="text-sm font-extrabold text-gray-900">Finish onboarding</div>
              <div className="text-xs text-gray-500 mt-1">Complete contacts + setup</div>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
