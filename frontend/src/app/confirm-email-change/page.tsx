"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, Suspense } from "react";
function ConfirmEmailChangePageInner() {
  const params = useSearchParams();
  const token = useMemo(() => String(params.get("token") || "").trim(), [params]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function confirm() {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/auth/email/change/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      window.location.href = "/siddes-profile/account";
      return;
    }
    setMsg(data?.error ? String(data.error) : "Confirmation failed");
    setBusy(false);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="text-sm font-black text-gray-900">Confirm email change</div>
        <div className="text-xs text-gray-500 mt-1">This updates your Siddes account email.</div>

        {!token ? (
          <div className="mt-4 text-sm text-rose-600 font-semibold">Missing token.</div>
        ) : null}

        {msg ? <div className="mt-4 text-sm text-rose-600 font-semibold">{msg}</div> : null}

        <button
          type="button"
          disabled={!token || busy}
          onClick={confirm}
          className="mt-5 w-full rounded-full py-3 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-60"
        >
          {busy ? "Confirming…" : "Confirm"}
        </button>

        <div className="mt-4 text-sm text-gray-600 text-center">
          <Link href="/login" className="font-bold text-gray-900 hover:underline">Back to login</Link>
        </div>
      </div>
    </div>
  );
}


export default function ConfirmEmailChangePage(props: any) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white p-6 text-sm text-gray-500">Loading...</div>}>
      <ConfirmEmailChangePageInner {...props} />
    </Suspense>
  );
}
