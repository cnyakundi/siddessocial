"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function humanizeErr(err: string): string {
  const e = String(err || "").trim().toLowerCase();
  if (e === "restricted") return "You must be logged in.";
  if (e === "email_not_verified") return "Verify your email first, then try again.";
  if (e === "missing_email") return "Your account has no email address on file.";
  if (e === "email_send_failed") return "Email could not be sent. Try again later.";
  if (e === "proxy_fetch_failed") return "Server connection failed — is the backend running?";
  return err ? err.replace(/_/g, " ") : "Request failed";
}

export default function DangerZonePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
      const me = await meRes?.json().catch(() => ({} as any));
      if (!me?.authenticated) {
        const next = encodeURIComponent("/siddes-profile/account/danger");
        router.replace(`/login?next=${next}`);
        return;
      }
      setAuthed(true);
    })();
  }, []);

  async function deactivate() {
    if (!window.confirm("Deactivate your account now? You will be logged out.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/account/deactivate", { method: "POST" });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok && data?.ok) {
        router.replace("/login");
        return;
      }
      setMsg(humanizeErr(String(data?.error || "")));
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function requestDelete() {
    if (!window.confirm("Send deletion confirmation email?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/account/delete/request", { method: "POST" });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok && data?.ok) {
        setMsg("Deletion confirmation sent. Check your email.");
      } else {
        setMsg(humanizeErr(String(data?.error || "")));
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">Danger zone</div>
            <div className="text-xs text-gray-500 mt-1">Deactivate or delete account</div>
          </div>
          <Link
            href="/siddes-profile/account"
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-extrabold text-gray-900">Deactivate</div>
          <div className="text-xs text-gray-500 mt-1">Disables your account immediately and logs you out.</div>
          <button
            type="button"
            onClick={deactivate}
            disabled={!authed || busy}
            className="mt-3 w-full rounded-full py-3 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-60"
          >
            {busy ? "Working…" : "Deactivate account"}
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-rose-200 bg-white p-4">
          <div className="text-sm font-extrabold text-rose-700">Delete</div>
          <div className="text-xs text-gray-500 mt-1">
            Irreversible. Requires verified email. We send a confirmation link to your email.
          </div>

          <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700">
            Before you delete: download your data export.
            <span className="ml-1">
              <Link href="/siddes-profile/account/export" className="font-bold text-gray-900 hover:underline">
                Export data
              </Link>
            </span>
          </div>

          <button
            type="button"
            onClick={requestDelete}
            disabled={!authed || busy}
            className="mt-3 w-full rounded-full py-3 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "Working…" : "Send delete confirmation email"}
          </button>

          {msg ? <div className="mt-3 text-sm text-gray-700 font-semibold">{msg}</div> : null}

          <div className="mt-3 text-xs text-gray-500">
            Can’t access the app? See{" "}
            <Link href="/legal/account-deletion" className="font-bold text-gray-900 hover:underline">
              account deletion help
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

