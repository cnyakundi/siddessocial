"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useMemo, useState } from "react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const params = useSearchParams();
  const token = useMemo(() => String(params.get("token") || "").trim(), [params]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const okToken = token.length > 0;
  const match = password.length > 0 && password === confirm;
  const canSubmit = okToken && password.length >= 8 && match && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/auth/password/reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      window.location.href = "/siddes-feed";
      return;
    }
    setMsg(data?.error ? String(data.error) : "Reset failed");
    setBusy(false);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/siddes_s_stroke_mark_color.svg" alt="Siddes" className="w-10 h-10" />
          <div className="min-w-0">
            <div className="font-black text-lg tracking-tight text-gray-900 leading-none">Siddes</div>
            <div className="text-[11px] text-gray-500 font-semibold">Set a new password</div>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-black text-gray-900 tracking-tight">Reset password</h1>
        <p className="text-sm text-gray-500 mt-1">
          {okToken ? "Choose a new password." : "Missing token. Open the link from your email."}
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">New password</label>
          <input
            type="password"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />

          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confirm password</label>
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

          {msg ? <div className="text-sm text-rose-600 font-medium">{msg}</div> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full rounded-full py-3 text-sm font-bold text-white ${
              canSubmit ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {busy ? "Saving..." : "Set new password"}
          </button>

          <div className="text-sm text-gray-600 mt-4 text-center">
            <Link href="/login" className="font-bold text-gray-900 hover:underline">
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
