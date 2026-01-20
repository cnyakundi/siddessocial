"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MePayload = {
  ok?: boolean;
  authenticated?: boolean;
};

export default function AccountPasswordPage() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as any;
        if (!mounted) return;
        setMe(j || {});
        if (!j?.authenticated) {
          const next = encodeURIComponent("/siddes-profile/account/password");
          window.location.href = `/login?next=${next}`;
          return;
        }
      } catch {
        if (!mounted) return;
        setMe({ ok: false, authenticated: false });
        const next = encodeURIComponent("/siddes-profile/account/password");
        window.location.href = `/login?next=${next}`;
        return;
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const match = newPassword.length > 0 && newPassword === confirm;
  const canSubmit = !busy && newPassword.length >= 8 && match;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);

    const res = await fetch("/api/auth/password/change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
      setMsg("Password updated.");
      setBusy(false);
      return;
    }
    setMsg(data?.error ? String(data.error) : "Update failed");
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-xl mx-auto px-4 py-6">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">Password</div>
            <div className="text-xs text-gray-500 mt-1">Change or set a password for your account.</div>
          </div>
          <Link
            href="/siddes-profile/account"
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">
            If you signed up with Google and never set a password, leave <span className="font-bold">current password</span> blank.
          </div>

          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current password (optional)</label>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">New password</label>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />

            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confirm new password</label>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />

            {!match && confirm.length > 0 ? (
              <div className="text-xs text-rose-600 font-semibold">Passwords do not match.</div>
            ) : null}

            {msg ? <div className="text-sm text-gray-700 font-semibold">{msg}</div> : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full rounded-full py-3 text-sm font-bold text-white ${
                canSubmit ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {busy ? "Saving..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
