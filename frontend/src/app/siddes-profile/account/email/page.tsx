"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MePayload = {
  authenticated?: boolean;
  user?: { email: string; username: string };
  emailVerified?: boolean;
};

export default function AccountEmailPage() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
      const j = (await res?.json().catch(() => ({}))) as any;
      if (!mounted) return;
      setMe(j || {});
      setLoading(false);
      if (!j?.authenticated) {
        const next = encodeURIComponent("/siddes-profile/account/email");
        window.location.href = `/login?next=${next}`;
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function requestChange() {
    if (!newEmail.includes("@")) {
      setMsg("Enter a valid email.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/email/change/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setMsg("We sent a confirmation link to the new email.");
      } else {
        setMsg(data?.error ? String(data.error) : "Request failed");
      }
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
            <div className="text-sm font-black text-gray-900">Email</div>
            <div className="text-xs text-gray-500 mt-1">Change your account email</div>
          </div>
          <Link
            href="/siddes-profile/account"
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <div className="text-xs text-gray-500">
                Current email:
                <span className="ml-2 font-bold text-gray-900">{me?.user?.email || "—"}</span>
                {me?.emailVerified ? (
                  <span className="ml-2 text-emerald-700 font-bold">Verified</span>
                ) : (
                  <span className="ml-2 text-rose-700 font-bold">Not verified</span>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <label htmlFor="acct-new-email" className="text-xs font-bold text-gray-500 uppercase tracking-wider">New email</label>
                <input
                  id="acct-new-email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value.trim())}
                  placeholder="new@email.com"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:bg-white focus:border-gray-300 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                />

                <label htmlFor="acct-email-password" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password (may be required)</label>
                <input
                  id="acct-email-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:bg-white focus:border-gray-300 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                />

                {msg ? (
                  <div id="acct-email-msg" aria-live="polite" className="text-sm text-gray-700 font-semibold">
                    {msg}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={requestChange}
                  disabled={busy}
                  className="w-full rounded-full py-3 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send confirmation to new email"}
                </button>

                <div className="text-xs text-gray-500">
                  You’ll need to click the link in the new email to complete the change.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
