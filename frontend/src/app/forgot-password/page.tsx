"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = identifier.trim().length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/password/reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      await res.json().catch(() => ({}));
      setSent(true);
      setMsg("If an account exists, we emailed a reset link.");
    } catch {
      // privacy posture: same message regardless
      setSent(true);
      setMsg("If an account exists, we emailed a reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/siddes_s_stroke_mark_color.svg" alt="Siddes" className="w-10 h-10" />
          <div className="min-w-0">
            <div className="font-black text-lg tracking-tight text-gray-900 leading-none">Siddes</div>
            <div className="text-[11px] text-gray-500 font-semibold">Reset password</div>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-black text-gray-900 tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter your email (or username). If an account exists, we will send a reset link.
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label
            htmlFor="forgot-identifier"
            className="text-xs font-bold text-gray-500 uppercase tracking-wider"
          >
            Email or username
          </label>
          <input
            id="forgot-identifier"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:bg-white focus:border-gray-300 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@email.com or username"
            autoComplete="username"
          />

          {msg ? (
            <div id="forgot-msg" aria-live="polite" className="text-sm text-gray-700 font-medium">
              {msg}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full rounded-full py-3 text-sm font-bold text-white ${
              canSubmit ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {busy ? "Sending..." : sent ? "Resend link" : "Send reset link"}
          </button>

          <div className="text-sm text-gray-600 mt-4 text-center">
            <Link href="/login" className="font-bold text-gray-900 hover:underline">
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
