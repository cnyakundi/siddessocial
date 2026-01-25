"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AuthLegal from "@/src/components/auth/AuthLegal";
import AuthShell from "@/src/components/auth/AuthShell";
import GoogleGsiButton from "@/src/components/auth/GoogleGsiButton";

function googleClientId(): string {
  return String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
}

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  const next = String(raw).trim();
  if (!next) return null;
  // Only allow same-site relative paths (prevents https://evil.com and //evil.com)
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  // Block backslashes and newlines (edge-case parser tricks)
  if (next.includes("\\") || /[\r\n]/.test(next)) return null;
  return next;
}

function humanizeAuthError(err: string, status: number, kind: "login" | "signup"): string {
  const e = String(err || "").trim();
  const low = e.toLowerCase();
  if (low === "invalid_credentials") return "Incorrect email/username or password.";
  if (low === "signup_unavailable") return "That email or username is already taken.";
  if (low === "weak_password") return "Password is too weak.";
  if (low === "invalid_email") return "Enter a valid email address.";
  if (low === "proxy_fetch_failed" || status === 502) return "Server connection failed — is the backend running?";
  if (low === "backend_not_configured") return "Backend not configured (missing SD_INTERNAL_API_BASE).";
  if (!e) return status >= 500 ? "Server error" : kind === "signup" ? "Signup failed" : "Login failed";
  return e.replace(/_/g, " ");
}


export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const gid = googleClientId();

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        if (!r.ok) {
          if (!cancelled) setBackendOk(false);
          return;
        }
        const d: any = await r.json().catch(() => ({}));
        if (!cancelled) setBackendOk(Boolean(d && d.ok));
      } catch {
        if (!cancelled) setBackendOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (!canSubmit) return;
    setMsg(null);
    setDebug(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
        window.location.href = next ?? "/siddes-feed";
        return;
      }

      const err = String(data?.error || "");
      const rid = String(data?.requestId || "");
      const detail = String(data?.detail || "");
      const proxyOrigin = res.headers.get("x-sd-proxy-origin") || "";
      const proxyUrl = res.headers.get("x-sd-proxy-url") || String(data?.url || "");

      setMsg(humanizeAuthError(err, res.status, "login"));
      if (res.status === 502 || err === "proxy_fetch_failed") setBackendOk(false);

      if (process.env.NODE_ENV !== "production") {
        const parts: string[] = [];
        if (rid) parts.push(`rid=${rid}`);
        if (err === "proxy_fetch_failed" || res.status === 502) {
          if (proxyOrigin) parts.push(`origin=${proxyOrigin}`);
          if (proxyUrl) parts.push(`url=${proxyUrl}`);
          if (detail) parts.push(`detail=${detail}`);
        }
        if (parts.length) setDebug(parts.join(" • "));
      }
    } catch (e: any) {
      setMsg("Connection failed — check your network / dev server.");
      if (process.env.NODE_ENV !== "production") setDebug(String(e?.message || e));
      setBackendOk(false);
    }
  }


  const showGidNotice = !gid && process.env.NODE_ENV !== "production";

  return (
    <AuthShell title="Welcome back" subtitle="Sign in. Your Sides stay safe by design.">
      {process.env.NODE_ENV !== "production" && backendOk === false ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Backend unreachable — restart <span className="font-mono">docker-backend</span>.
        </div>
      ) : null}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email or username</label>
        <input
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@email.com or username"
          autoComplete="username"
        />

        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-3 block">Password</label>
        <input
          type="password"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between">
          <Link href="/magic-request" className="text-xs font-bold text-gray-600 hover:text-gray-900 hover:underline">
            Email me a sign-in link
          </Link>
          <Link href="/forgot-password" className="text-xs font-bold text-gray-600 hover:text-gray-900 hover:underline">
            Forgot password?
          </Link>
        </div>

        {msg ? <div className="text-sm text-rose-600 font-medium">{msg}</div> : null}

        {process.env.NODE_ENV !== "production" && debug ? (
          <div className="text-[11px] text-gray-500">{debug}</div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full rounded-full py-3 text-sm font-bold text-white ${
            canSubmit ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          Sign in
        </button>

        {gid ? (
          <>
            <div className="text-center text-xs text-gray-500">or</div>
            <GoogleGsiButton
              clientId={gid}
              onCredential={async (credential) => {
                setMsg(null);
                const r = await fetch("/api/auth/google", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ credential }),
                });
                const d = await r.json().catch(() => ({}));
                if (r.ok && d?.ok) {
                  const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
                  window.location.href = next ?? (d?.created ? "/onboarding" : "/siddes-feed");
                  return;
                }
                setMsg(d?.error ? String(d.error) : "Google sign-in failed");
              }}
            />
          </>
        ) : null}

        <div className="text-sm text-gray-600 mt-4 text-center">
          New here?{" "}
          <Link href="/signup" className="font-bold text-gray-900 hover:underline">
            Create account
          </Link>
        </div>

        <AuthLegal />

        {showGidNotice ? (
          <div className="mt-5 text-[11px] text-amber-600 text-center">
            Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID — Google button won’t render.
          </div>
        ) : null}
      </form>
    </AuthShell>
  );
}

