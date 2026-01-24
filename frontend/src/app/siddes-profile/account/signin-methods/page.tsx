"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Methods = {
  password?: { enabled: boolean };
  email?: { exists: boolean; verified: boolean; hint?: string };
  magicLink?: { enabled: boolean };
  passkeys?: { count: number };
  google?: { connected: boolean };
  apple?: { connected: boolean };
  phone?: { connected: boolean; hint?: string };
};

type ConnectedPayload = {
  ok?: boolean;
  authenticated?: boolean;
  methods?: Methods;
  error?: string;
};

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const cls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-gray-200 bg-gray-50 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${cls}`}>
      {children}
    </span>
  );
}

function Row({
  title,
  desc,
  right,
  href,
}: {
  title: string;
  desc: string;
  right: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-extrabold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-1">{desc}</div>
      </div>
      <div className="pt-0.5">{right}</div>
    </div>
  );
  if (!href) return <div className="rounded-2xl border border-gray-200 bg-white p-4">{inner}</div>;
  return (
    <Link href={href} className="block rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4">
      {inner}
    </Link>
  );
}

export default function SignInMethodsPage() {
  const [data, setData] = useState<ConnectedPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/connected", { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as any;
        if (!mounted) return;
        if (j && typeof j === "object") setData(j);
        else setData({ ok: false, error: "bad_response" });
      } catch {
        if (!mounted) return;
        setData({ ok: false, error: "network_error" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const methods: Methods = useMemo(() => data?.methods || {}, [data]);
  const authed = !!data?.authenticated;

  const emailHint = methods.email?.hint || "";
  const emailVerified = !!methods.email?.verified;
  const hasPw = !!methods.password?.enabled;
  const passkeysCount = Number(methods.passkeys?.count || 0);

  const googleOn = !!methods.google?.connected;
  const appleOn = !!methods.apple?.connected;
  const phoneOn = !!methods.phone?.connected;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">Sign-in methods</div>
            <div className="text-xs text-gray-500 mt-1">What you can use to access your account</div>
          </div>
          <Link
            href="/siddes-profile/account"
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-sm text-gray-500">Loading methods…</div>
            </div>
          ) : !authed ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-bold text-gray-900">Not signed in</div>
              <div className="text-xs text-gray-500 mt-1">Sign in again to view your methods.</div>
              <div className="mt-3">
                <Link href="/login" className="inline-flex px-3 py-2 rounded-xl text-sm font-extrabold bg-black text-white hover:opacity-90">
                  Go to login
                </Link>
              </div>
            </div>
          ) : (
            <>
              <Row
                title="Email"
                desc={emailHint ? emailHint : "No email on this account yet"}
                right={
                  methods.email?.exists ? (
                    <Badge tone={emailVerified ? "good" : "warn"}>{emailVerified ? "Verified" : "Not verified"}</Badge>
                  ) : (
                    <Badge>Missing</Badge>
                  )
                }
                href="/siddes-profile/account/email"
              />

              <Row
                title="Password"
                desc={hasPw ? "You can sign in with email + password." : "No password set yet (recommended as backup)."}
                right={hasPw ? <Badge tone="good">Enabled</Badge> : <Badge tone="warn">Not set</Badge>}
                href="/siddes-profile/account/password"
              />

              <Row
                title="Magic link"
                desc="Sign in from your inbox (no password)."
                right={methods.magicLink?.enabled ? <Badge tone="good">Available</Badge> : <Badge tone="warn">Needs email</Badge>}
              />

              <Row
                title="Passkeys"
                desc="Fast, phishing-resistant sign-in."
                right={<Badge tone={passkeysCount > 0 ? "good" : "warn"}>{passkeysCount > 0 ? `${passkeysCount} saved` : "None yet"}</Badge>}
                href="/siddes-profile/account/passkeys"
              />

              <Row
                title="Google"
                desc="Google sign-in is connected to this account."
                right={googleOn ? <Badge tone="good">Connected</Badge> : <Badge>Not connected</Badge>}
              />

              <Row
                title="Apple"
                desc="Apple sign-in is connected to this account."
                right={appleOn ? <Badge tone="good">Connected</Badge> : <Badge>Not connected</Badge>}
              />

              <Row
                title="Phone"
                desc="Sign in via one-time code."
                right={phoneOn ? <Badge tone="good">Connected</Badge> : <Badge>Not connected</Badge>}
              />

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-500">
                  Tip: your safest combo is <span className="font-bold text-gray-900">Passkey + Magic link</span>, with password as backup.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
