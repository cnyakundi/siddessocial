"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import AuthShell from "@/src/components/auth/AuthShell";

function humanizeTokenError(err: string): string {
  const e = String(err || "").trim().toLowerCase();
  if (e === "missing_token") return "Missing reset token. Paste the token from your email.";
  if (e === "invalid_token") return "That reset link/token isn’t valid. Request a new one.";
  if (e === "token_used") return "That reset link/token was already used. Request a new one.";
  if (e === "token_expired") return "That reset link/token expired. Request a new one.";
  if (e === "weak_password") return "Pick a stronger password (8+ characters)."; // backend may add detail[]
  if (e === "account_inactive") return "This account is inactive. You can’t reset a password for it.";
  if (e === "proxy_fetch_failed") return "Server connection failed — is the backend running?";
  return err ? err.replace(/_/g, " ") : "Reset failed";
}

type ResetResp = { ok?: boolean; reset?: boolean; error?: string; detail?: string[] };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const params = useSearchParams();
  const urlToken = useMemo(() => String(params.get("token") || "").trim(), [params]);

  const [token, setToken] = useState(urlToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // If token arrives via URL, prefill (but don't clobber manual edits).
    if (urlToken && !token) setToken(urlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  const okToken = token.trim().length > 0;
  const match = password.length > 0 && password === confirm;
  const canSubmit = okToken && password.length >= 8 && match && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    setDetail(null);

    const res = await fetch("/api/auth/password/reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: token.trim(), password }),
    });

    const data = (await res.json().catch(() => ({}))) as ResetResp;

    if (res.ok && data?.ok && data?.reset) {
      window.location.href = "/siddes-feed";
      return;
    }

    setMsg(humanizeTokenError(String(data?.error || "")));
    if (Array.isArray(data?.detail) && data.detail.length) setDetail(data.detail.map(String).slice(0, 3));
    setBusy(false);
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={urlToken ? "Choose a new password." : "Paste the token from your email, then set a new password."}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reset token</label>
        <input
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300 font-mono"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste token"
          autoComplete="off"
          spellCheck={false}
        />

        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-3 block">New password</label>
        <input
          type="password"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />

        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-3 block">Confirm password</label>
        <input
          type="password"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />

        {!match && confirm.length > 0 ? <div className="text-xs text-rose-600 font-semibold">Passwords do not match.</div> : null}

        {msg ? <div className="text-sm text-rose-600 font-medium">{msg}</div> : null}
        {detail && detail.length ? (
          <ul className="text-xs text-rose-600 font-medium list-disc pl-5">
            {detail.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full rounded-full py-3 text-sm font-bold text-white ${
            canSubmit ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          {busy ? "Saving…" : "Set new password"}
        </button>

        <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
          <Link href="/forgot-password" className="font-bold text-gray-900 hover:underline">
            Request a new link
          </Link>
          <Link href="/login" className="font-bold text-gray-900 hover:underline">
            Back to login
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

