"use client";

import Link from "next/link";
import { useState } from "react";
import AuthShell from "@/src/components/auth/AuthShell";
import AuthLegal from "@/src/components/auth/AuthLegal";

function humanizeErr(err: string): string {
  const e = String(err || "").trim().toLowerCase();
  if (e === "invalid_email") return "Enter a valid email address.";
  if (e === "email_send_failed") return "Email could not be sent. Try again later.";
  if (e === "proxy_fetch_failed") return "Server connection failed — is the backend running?";
  return err ? err.replace(/_/g, " ") : "Request failed";
}

export default function MagicRequestPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/auth/magic/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({} as any));

      // Privacy posture: backend always returns ok for non-existent accounts too.
      if (res.ok && data?.ok) {
        setMsg("If an account exists for that email, we sent a one-time sign-in link.");
      } else {
        setErr(humanizeErr(String(data?.error || "")));
      }
    } catch {
      // still show generic OK (privacy posture)
      setMsg("If an account exists for that email, we sent a one-time sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Email sign-in link" subtitle="We’ll email you a one-time sign-in link.">
      <form
        className="space-y-3"
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

        {msg ? <div className="text-sm text-gray-700 font-medium">{msg}</div> : null}
        {err ? <div className="text-sm text-rose-600 font-medium">{err}</div> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full rounded-full py-3 text-sm font-bold text-white ${
            canSubmit ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          {busy ? "Sending…" : "Send sign-in link"}
        </button>

        <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
          <Link href="/login" className="font-bold text-gray-900 hover:underline">
            Back to login
          </Link>
          <Link href="/forgot-password" className="font-bold text-gray-900 hover:underline">
            Forgot password?
          </Link>
        </div>

        <AuthLegal />
      </form>
    </AuthShell>
  );
}

