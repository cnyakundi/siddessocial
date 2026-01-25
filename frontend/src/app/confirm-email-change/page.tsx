"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import AuthShell from "@/src/components/auth/AuthShell";

function humanizeConfirmError(err: string): string {
  const e = String(err || "").trim().toLowerCase();
  if (e === "missing_token") return "Missing confirmation token. Paste the token from your email.";
  if (e === "invalid_token") return "That confirmation link/token isn’t valid. Request a new email change.";
  if (e === "token_used") return "That confirmation link/token was already used. Request a new email change.";
  if (e === "token_expired") return "That confirmation link/token expired. Request a new email change.";
  if (e === "email_taken") return "That email is already in use.";
  if (e === "proxy_fetch_failed") return "Server connection failed — is the backend running?";
  return err ? err.replace(/_/g, " ") : "Confirmation failed";
}

export default function ConfirmEmailChangePage(props: any) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white p-6 text-sm text-gray-500">Loading…</div>}>
      <ConfirmEmailChangePageInner {...props} />
    </Suspense>
  );
}

function ConfirmEmailChangePageInner() {
  const params = useSearchParams();
  const urlToken = useMemo(() => String(params.get("token") || "").trim(), [params]);

  const [token, setToken] = useState(urlToken);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (urlToken && !token) setToken(urlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  async function confirm() {
    const tok = token.trim();
    if (!tok) {
      setMsg("Missing token.");
      return;
    }
    setBusy(true);
    setMsg(null);

    const res = await fetch("/api/auth/email/change/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: tok }),
    });

    const data = await res.json().catch(() => ({} as any));

    if (res.ok && data?.ok) {
      window.location.href = "/siddes-profile/account";
      return;
    }

    setMsg(humanizeConfirmError(String(data?.error || "")));
    setBusy(false);
  }

  return (
    <AuthShell title="Confirm email change" subtitle="This updates the email on your Siddes account.">
      <div className="space-y-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confirmation token</label>
        <input
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300 font-mono"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste token"
          autoComplete="off"
          spellCheck={false}
        />

        {msg ? <div className="text-sm text-rose-600 font-semibold">{msg}</div> : null}

        <button
          type="button"
          disabled={!token.trim() || busy}
          onClick={confirm}
          className="w-full rounded-full py-3 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-60"
        >
          {busy ? "Confirming…" : "Confirm"}
        </button>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <Link href="/siddes-profile/account" className="font-bold text-gray-900 hover:underline">
            Back to account
          </Link>
          <Link href="/login" className="font-bold text-gray-900 hover:underline">
            Login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

