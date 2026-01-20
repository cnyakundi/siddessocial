"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const gid = googleClientId();

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  async function submit() {
    if (!canSubmit) return;
    setMsg(null);
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
    setMsg(data?.error ? String(data.error) : "Login failed");
  }

  // Google Identity Services (industry-standard)
  useEffect(() => {
    if (!gid) return;

    const existing = document.getElementById("google-gsi");
    if (existing) return;

    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.id = "google-gsi";
    s.onload = () => {
      // @ts-ignore
      const g = window.google;
      if (!g?.accounts?.id) return;

      g.accounts.id.initialize({
        client_id: gid,
        callback: async (resp: any) => {
          setMsg(null);
          const r = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ credential: resp.credential }),
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok && d?.ok) {
            const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
            window.location.href = next ?? (d?.created ? "/onboarding" : "/siddes-feed");
            return;
          }
          setMsg(d?.error ? String(d.error) : "Google sign-in failed");
        },
      });

      g.accounts.id.renderButton(document.getElementById("google-btn"), {
        theme: "outline",
        size: "large",
        width: 360,
      });
    };

    document.head.appendChild(s);
  }, [gid]);

  const showGidNotice = !gid && process.env.NODE_ENV !== "production";

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/siddes_s_stroke_mark_color.svg" alt="Siddes" className="w-10 h-10" />
          <div className="min-w-0">
            <div className="font-black text-lg tracking-tight text-gray-900 leading-none">Siddes</div>
            <div className="text-[11px] text-gray-500 font-semibold">Context-safe social OS</div>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-black text-gray-900 tracking-tight">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in. Your Sides stay safe by design.</p>

        <form
          className="mt-6 space-y-3"
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

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-bold text-gray-600 hover:text-gray-900 hover:underline"
            >
              Forgot password?
            </Link>
          </div>


          {msg ? <div className="text-sm text-rose-600 font-medium">{msg}</div> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full rounded-full py-3 text-sm font-bold text-white ${
              canSubmit ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Sign in
          </button>

          <div className="text-center text-xs text-gray-500">or</div>
          <div id="google-btn" className="flex justify-center" />

          <div className="text-sm text-gray-600 mt-4 text-center">
            New here?{" "}
            <Link href="/signup" className="font-bold text-gray-900 hover:underline">
              Create account
            </Link>
          </div>

          <div className="mt-5 text-xs text-gray-500 text-center">
            <Link href="/about" className="hover:underline">About</Link>
          </div>

          <div className="mt-4 text-[11px] text-gray-500 text-center leading-relaxed">
            By continuing, you agree to the
            <Link href="/terms" className="font-semibold text-gray-700 hover:underline">Terms</Link> and acknowledge the
            <Link href="/privacy" className="font-semibold text-gray-700 hover:underline">Privacy Policy</Link>.
            <span className="block">Read our <Link href="/community-guidelines" className="font-semibold text-gray-700 hover:underline">Community Guidelines</Link>.</span>
          </div>
        </form>

        {showGidNotice ? (
          <div className="mt-5 text-[11px] text-amber-600">
            Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID — Google button won’t render.
          </div>
        ) : null}
      </div>
    </div>
  );
}

