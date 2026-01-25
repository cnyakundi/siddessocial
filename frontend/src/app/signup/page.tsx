"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AuthLegal from "@/src/components/auth/AuthLegal";
import AuthShell from "@/src/components/auth/AuthShell";
import GoogleGsiButton from "@/src/components/auth/GoogleGsiButton";

function googleClientId(): string {
  return String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
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


export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ageOk, setAgeOk] = useState(false); // sd_399_age_gate
  const [msg, setMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const gid = googleClientId();

  const canSubmit = email.includes("@") && /^[a-z0-9_]{3,24}$/.test(username.trim()) && password.length >= 8 && ageOk;

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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, username, password, ageConfirmed: ageOk }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        window.location.href = "/onboarding";
        return;
      }

      const err = String(data?.error || "");
      const rid = String(data?.requestId || "");
      const detail = String(data?.detail || "");
      const proxyOrigin = res.headers.get("x-sd-proxy-origin") || "";
      const proxyUrl = res.headers.get("x-sd-proxy-url") || String(data?.url || "");

      setMsg(humanizeAuthError(err, res.status, "signup"));
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
    <AuthShell title="Create your Siddes" subtitle="Quick start. Calm onboarding. Context-safe by default.">
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
        <label htmlFor="signup-email" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</label>
        <input
          id="signup-email"
          aria-invalid={!!msg}
          aria-describedby={msg ? "signup-error" : undefined}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:bg-white focus:border-gray-300 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
        />

        <label htmlFor="signup-username" className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-3 block">Username</label>
        <input
          id="signup-username"
          aria-invalid={!!msg}
          aria-describedby={msg ? "signup-error" : undefined}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:bg-white focus:border-gray-300 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24))}
          placeholder="3–24 chars, lowercase a-z / 0-9 / _"
          autoComplete="username"
        />

        <label htmlFor="signup-password" className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-3 block">Password</label>
        <input
          type="password"
          id="signup-password"
          aria-invalid={!!msg}
          aria-describedby={msg ? "signup-error" : undefined}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:bg-white focus:border-gray-300 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="min 8 characters"
          autoComplete="new-password"
        />

        <label className="flex items-start gap-2 text-xs text-gray-600">
          <input id="signup-age-ok" type="checkbox" className="mt-0.5" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
          <span>I confirm I'm at least 13 years old (or the minimum age required in my country).</span>
        </label>

        {msg ? (
          <div id="signup-error" role="alert" className="text-sm text-rose-600 font-medium">
            {msg}
          </div>
        ) : null}

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
          Create account
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
                  window.location.href = "/onboarding";
                  return;
                }
                setMsg(d?.error ? String(d.error) : "Google sign-up failed");
              }}
            />
          </>
        ) : null}

        <div className="text-sm text-gray-600 mt-4 text-center">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-gray-900 hover:underline">
            Sign in
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
