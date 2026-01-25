"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import AuthShell from "@/src/components/auth/AuthShell";

function humanizeDeleteError(err: string): string {
  const e = String(err || "").trim().toLowerCase();
  if (e === "missing_token") return "Missing deletion token. Paste the token from your email.";
  if (e === "invalid_token") return "That deletion link/token isn’t valid. Request a new delete email.";
  if (e === "token_used") return "That deletion link/token was already used. Request a new delete email.";
  if (e === "token_expired") return "That deletion link/token expired. Request a new delete email.";
  if (e === "proxy_fetch_failed") return "Server connection failed — is the backend running?";
  return err ? err.replace(/_/g, " ") : "Delete failed";
}

export default function ConfirmDeletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white p-6 text-sm text-gray-500">Loading…</div>}>
      <ConfirmDeletePageInner />
    </Suspense>
  );
}

function ConfirmDeletePageInner() {
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
    if (!window.confirm("Delete your account now? This is irreversible.")) return;

    setBusy(true);
    setMsg(null);

    const res = await fetch("/api/auth/account/delete/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: tok }),
    });

    const data = await res.json().catch(() => ({} as any));

    if (res.ok && data?.ok) {
      window.location.href = "/login";
      return;
    }

    setMsg(humanizeDeleteError(String(data?.error || "")));
    setBusy(false);
  }

  return (
    <AuthShell title="Confirm account deletion" subtitle="This will deactivate your account immediately.">
      <div className="space-y-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          Before you delete: consider downloading your data export.
          <span className="ml-1">
            <Link href="/siddes-profile/account/export" className="font-bold underline">
              Export data
            </Link>
          </span>
        </div>

        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Deletion token</label>
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
          disabled={busy || !token.trim()}
          onClick={confirm}
          className="w-full rounded-full py-3 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Confirm delete"}
        </button>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <Link href="/siddes-profile/account/danger" className="font-bold text-gray-900 hover:underline">
            Request new delete email
          </Link>
          <Link href="/login" className="font-bold text-gray-900 hover:underline">
            Back to login
          </Link>
        </div>

        <div className="text-xs text-gray-500">
          Can’t access the app? See{" "}
          <Link href="/legal/account-deletion" className="font-bold text-gray-900 hover:underline">
            account deletion help
          </Link>
          .
        </div>
      </div>
    </AuthShell>
  );
}

