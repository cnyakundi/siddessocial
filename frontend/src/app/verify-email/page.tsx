"use client";

import Link from "next/link";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/src/components/auth/AuthShell";

type VerifyResp = {
  ok?: boolean;
  verified?: boolean;
  error?: string;
  onboarding?: { completed?: boolean; step?: string };
};

function humanizeVerifyError(err: string): string {
  const e = String(err || "").trim().toLowerCase();
  if (e === "missing_token") return "Missing verification token. Paste the token from your email.";
  if (e === "invalid_token") return "That verification link/token isn’t valid. Request a new one.";
  if (e === "token_used") return "That verification link/token was already used.";
  if (e === "token_expired") return "That verification link/token expired. Request a new one.";
  if (e === "account_inactive") return "This account is inactive.";
  if (e === "restricted") return "Please log in to resend verification.";
  if (e === "proxy_fetch_failed") return "Server connection failed — is the backend running?";
  return err ? err.replace(/_/g, " ") : "Verification failed";
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}

function VerifyEmailPageInner() {
  const sp = useSearchParams();
  const urlToken = useMemo(() => String(sp?.get("token") || "").trim(), [sp]);

  const [token, setToken] = useState(urlToken);
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean>(false);

  useEffect(() => {
    if (urlToken && !token) setToken(urlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  async function verifyNow(t: string) {
    const tok = String(t || "").trim();
    if (!tok) {
      setStatus("err");
      setMsg("Missing verification token.");
      return;
    }
    setStatus("working");
    setMsg("Verifying your email…");
    try {
      const res = await fetch("/api/auth/verify/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tok }),
      });
      const data = (await res.json().catch(() => ({}))) as VerifyResp;

      if (res.ok && data?.ok && data?.verified) {
        setStatus("ok");
        setMsg("Email verified.");
        setOnboardingDone(Boolean(data?.onboarding?.completed));
        return;
      }

      setStatus("err");
      setMsg(humanizeVerifyError(String(data?.error || "")));
    } catch {
      setStatus("err");
      setMsg("Network error");
    }
  }

  // Auto-verify when arriving from email link.
  useEffect(() => {
    if (!urlToken) return;
    // only auto-run once from URL token
    // eslint-disable-next-line react-hooks/exhaustive-deps
    verifyNow(urlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resend() {
    setStatus("working");
    setMsg("Sending verification email…");
    try {
      const res = await fetch("/api/auth/verify/resend", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as any;

      if (res.ok && data?.ok) {
        setStatus("ok");
        setMsg("Verification email sent. Check your inbox.");
        return;
      }

      setStatus("err");
      setMsg(humanizeVerifyError(String(data?.error || "")));
    } catch {
      setStatus("err");
      setMsg("Network error");
    }
  }

  const nextHref = onboardingDone ? "/siddes-feed" : "/onboarding";

  return (
    <AuthShell title="Verify email" subtitle="This keeps your account safe and unlocks launch actions.">
      <div className="space-y-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Verification token</label>
        <input
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300 font-mono"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste token"
          autoComplete="off"
          spellCheck={false}
        />

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          {status === "working" ? (
            <div className="text-sm text-gray-700">{msg}</div>
          ) : status === "ok" ? (
            <div className="text-sm font-bold text-emerald-700">{msg}</div>
          ) : status === "err" ? (
            <div className="text-sm font-bold text-rose-700">{msg}</div>
          ) : (
            <div className="text-sm text-gray-700">Paste your token and verify.</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => verifyNow(token)}
          className="w-full rounded-full bg-gray-900 text-white text-sm font-bold px-5 py-3 hover:bg-gray-800"
        >
          Verify email
        </button>

        <button
          type="button"
          onClick={resend}
          className="w-full rounded-full border border-gray-200 bg-white text-sm font-bold px-5 py-3 hover:bg-gray-50"
        >
          Resend verification email
        </button>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <Link href={nextHref} className="font-bold text-gray-900 hover:underline">
            Continue
          </Link>
          <Link href="/login" className="font-bold text-gray-900 hover:underline">
            Login
          </Link>
        </div>

        {process.env.NODE_ENV !== "production" ? (
          <div className="text-xs text-gray-500">
            Tip: if you used the console email provider, check backend logs for the verify link/token.
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}

