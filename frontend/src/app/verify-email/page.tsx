"use client";

import Link from "next/link";
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type VerifyResp = {
  ok?: boolean;
  verified?: boolean;
  error?: string;
  onboarding?: { completed?: boolean };
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}

function VerifyEmailPageInner() {
  const sp = useSearchParams();
  const token = String(sp?.get("token") || "").trim();

  const [state, setState] = useState<{ status: "idle" | "working" | "ok" | "err"; msg?: string }>(
    { status: "idle" }
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!token) {
        setState({ status: "err", msg: "Missing token." });
        return;
      }

      setState({ status: "working", msg: "Verifying your email..." });
      try {
        const res = await fetch("/api/auth/verify/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => ({}))) as VerifyResp;
        if (!mounted) return;

        if (res.ok && data?.ok && data?.verified) {
          setState({ status: "ok", msg: "Email verified." });
          return;
        }

        setState({ status: "err", msg: data?.error ? String(data.error) : "Verification failed" });
      } catch {
        if (!mounted) return;
        setState({ status: "err", msg: "Network error" });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="text-2xl font-black text-gray-900 tracking-tight">Verify email</div>
        <div className="text-sm text-gray-500 mt-2">This keeps your account safe and unlocks launch actions.</div>

        <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
          {state.status === "working" ? (
            <div className="text-sm text-gray-700">{state.msg}</div>
          ) : state.status === "ok" ? (
            <div className="text-sm font-bold text-emerald-700">{state.msg}</div>
          ) : state.status === "err" ? (
            <div className="text-sm font-bold text-rose-700">{state.msg}</div>
          ) : (
            <div className="text-sm text-gray-700">Ready.</div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Link
            href="/onboarding"
            className="inline-flex rounded-full bg-gray-900 text-white text-sm font-bold px-5 py-2.5 hover:bg-gray-800"
          >
            Continue
          </Link>
          <Link href="/login" className="text-sm font-bold text-gray-900 hover:underline">
            Login
          </Link>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Tip: if you used the console email provider, check backend logs for the verify link/token.
        </div>
      </div>
    </div>
  );
}
