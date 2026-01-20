"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function googleClientId(): string {
  return String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ageOk, setAgeOk] = useState(false); // sd_399_age_gate
  const [msg, setMsg] = useState<string | null>(null);
  const gid = googleClientId();

  const canSubmit = email.includes("@") && /^[a-z0-9_]{3,24}$/.test(username.trim()) && password.length >= 8 && ageOk;

  async function submit() {
    if (!canSubmit) return;
    setMsg(null);
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
    setMsg(data?.error ? String(data.error) : "Signup failed");
  }

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
            window.location.href = "/onboarding";
            return;
          }
          setMsg(d?.error ? String(d.error) : "Google sign-up failed");
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

        <h1 className="mt-5 text-2xl font-black text-gray-900 tracking-tight">Create your Siddes</h1>
        <p className="text-sm text-gray-500 mt-1">Quick start. Calm onboarding. Context-safe by default.</p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</label>
          <input
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
          />

          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-3 block">Username</label>
          <input
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24))}
            placeholder="3–24 chars, lowercase a-z / 0-9 / _"
            autoComplete="username"
          />

          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-3 block">Password</label>
          <input
            type="password"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-gray-300"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 8 characters"
            autoComplete="new-password"
          />

          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={ageOk}
              onChange={(e) => setAgeOk(e.target.checked)}
            />
            <span>I confirm I'm at least 13 years old (or the minimum age required in my country).</span>
          </label>

          {msg ? <div className="text-sm text-rose-600 font-medium">{msg}</div> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full rounded-full py-3 text-sm font-bold text-white ${
              canSubmit ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Create account
          </button>

          <div className="text-center text-xs text-gray-500">or</div>
          <div id="google-btn" className="flex justify-center" />

          <div className="text-sm text-gray-600 mt-4 text-center">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-gray-900 hover:underline">
              Sign in
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

