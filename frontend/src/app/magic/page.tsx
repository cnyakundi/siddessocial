"use client";

import Link from "next/link";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/src/components/auth/AuthShell";

type ConsumeResp = { ok?: boolean; error?: string; created?: boolean };

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  const next = String(raw).trim();
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  if (next.includes("\\") || /[\r\n]/.test(next)) return null;
  return next;
}

function humanizeMagicError(err: string): string {
  const e = String(err || "").trim().toLowerCase();
  if (e === "missing_token") return "Missing sign-in token. Paste the token from your email.";
  if (e === "invalid_token") return "That sign-in link/token isn’t valid. Request a new one.";
  if (e === "token_used") return "That sign-in link/token was already used. Request a new one.";
  if (e === "token_expired") return "That sign-in link/token expired. Request a new one.";
  if (e === "account_inactive") return "This account is inactive.";
  if (e === "proxy_fetch_failed") return "Server connection failed — is the backend running?";
  return err ? err.replace(/_/g, " ") : "Sign-in failed";
}

export default function MagicConsumePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <MagicConsumePageInner />
    </Suspense>
  );
}

function MagicConsumePageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const urlToken = useMemo(() => String(sp?.get("token") || "").trim(), [sp]);
  const nextPath = useMemo(() => safeNextPath(sp?.get("next") || null), [sp]);

  const [token, setToken] = useState(urlToken);
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (urlToken && !token) setToken(urlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  async function consume(tok: string) {
    const t = String(tok || "").trim();
    if (!t) {
      setStatus("err");
      setMsg("Missing token.");
      return;
    }
    setStatus("working");
    setMsg("Signing you in…");
    try {
      const res = await fetch("/api/auth/magic/consume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const data = (await res.json().catch(() => ({}))) as ConsumeResp;

      if (res.ok && data?.ok) {
        setStatus("ok");
        setMsg("Signed in.");
        const dest = nextPath ?? (data?.created ? "/onboarding" : "/siddes-feed");
        router.replace(dest);
        return;
      }

      setStatus("err");
      setMsg(humanizeMagicError(String(data?.error || "")));
    } catch {
      setStatus("err");
      setMsg("Network error");
    }
  }

  useEffect(() => {
    if (!urlToken) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    consume(urlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthShell title="Sign in" subtitle="Use the token from your email to sign in.">
      <div className="space-y-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sign-in token</label>
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
            <div className="text-sm text-gray-700">Paste your token and sign in.</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => consume(token)}
          className="w-full rounded-full bg-gray-900 text-white text-sm font-bold px-5 py-3 hover:bg-gray-800"
        >
          Sign in
        </button>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <Link href="/magic-request" className="font-bold text-gray-900 hover:underline">
            Request a new link
          </Link>
          <Link href="/login" className="font-bold text-gray-900 hover:underline">
            Use password instead
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

