"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, ArrowRight, RefreshCcw } from "lucide-react";
import { fetchMe } from "@/src/lib/authMe";
import { toast } from "@/src/lib/toast";

type InviteLinkPublic = {
  ok?: boolean;
  valid?: boolean;
  reason?: string;
  item?: any;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

async function j<T>(res: Response): Promise<T> {
  const data = await res.json();
  return data as T;
}

export default function InviteLinkClient({ token, initial }: { token: string; initial: InviteLinkPublic | null }) {
  const router = useRouter();
  const [meAuthed, setMeAuthed] = useState<boolean | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);

  const [data, setData] = useState<InviteLinkPublic | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [err, setErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const safeToken = useMemo(() => encodeURIComponent(token || ""), [token]);
  const nextPath = `/i/${safeToken}`;

  const refresh = async () => {
    if (!safeToken) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/invite-links/${safeToken}`, { cache: "no-store" });
      if (!res.ok) {
        setErr(`Failed to load (${res.status}).`);
        setData(null);
        return;
      }
      const d = await j<InviteLinkPublic>(res);
      setData(d);
    } catch (e: any) {
      setErr(e?.message || "Failed to load invite link.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshMe = async () => {
    setLoadingMe(true);
    try {
      const me = await fetchMe();
      setMeAuthed(Boolean(me?.authenticated));
    } catch {
      setMeAuthed(false);
    } finally {
      setLoadingMe(false);
    }
  };

  useEffect(() => {
    void refreshMe();
    if (!initial) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeToken]);

  const join = async () => {
    if (!safeToken) return;
    setJoining(true);
    setErr(null);
    try {
      const res = await fetch(`/api/invite-links/${safeToken}/accept`, { method: "POST" });
      if (res.status === 401 || res.status === 403) {
        router.push(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }
      const d = await j<any>(res).catch(() => ({}));
      if (!res.ok || !d?.joined || !d?.setId) {
        setErr(d?.error ? String(d.error) : `Join failed (${res.status}).`);
        return;
      }
      toast.success("Joined");
      router.push(`/siddes-circles/${encodeURIComponent(String(d.setId))}`);
    } catch (e: any) {
      setErr(e?.message || "Join failed.");
    } finally {
      setJoining(false);
    }
  };

  const item = data?.item || null;
  const valid = Boolean(data?.valid);
  const label = typeof item?.setLabel === "string" && item.setLabel ? item.setLabel : "this Circle";
  const ownerHandle = item?.owner?.handle ? String(item.owner.handle) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-sm font-bold text-gray-700 hover:underline">
            Siddes
          </Link>

          <button
            type="button"
            onClick={() => void refresh()}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-full border font-bold text-xs",
              loading ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            )}
            disabled={loading}
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200">
          <div className="flex items-center gap-2 text-gray-900">
            <Link2 size={18} />
            <div className="font-black text-xl">Invite link</div>
          </div>

          {err ? (
            <div className="mt-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-800 text-sm">
              <div className="font-black">Error</div>
              <div className="text-xs mt-1">{err}</div>
            </div>
          ) : null}

          {loading ? <div className="mt-4 text-sm text-gray-500 font-bold">Loading…</div> : null}

          {!loading && !item ? <div className="mt-4 text-sm text-gray-600">Invite link not found (or expired).</div> : null}

          {item ? (
            <>
              <div className="mt-4">
                <div className="text-sm text-gray-700">
                  {ownerHandle ? (
                    <div className="text-xs text-gray-500 mb-1">
                      From <span className="font-black text-gray-900">{ownerHandle}</span>
                    </div>
                  ) : null}

                  <div className="font-black text-gray-900 text-lg">Join “{label}”</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Uses: <span className="font-mono">{item.uses}/{item.maxUses}</span>
                    {item.expiresAt ? (
                      <>
                        {" "}• Expires: <span className="font-mono">{new Date(item.expiresAt).toLocaleDateString()}</span>
                      </>
                    ) : null}
                  </div>

                  {!valid ? (
                    <div className="mt-3 p-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-sm">
                      This link is not active ({String(data?.reason || "inactive").replace(/_/g, " ")}).
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {meAuthed ? (
                  <button
                    type="button"
                    disabled={joining || !valid}
                    onClick={() => void join()}
                    className={cn(
                      "w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full border font-black text-sm",
                      joining || !valid ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
                    )}
                  >
                    {joining ? "Joining…" : "Join Set"} <ArrowRight size={16} />
                  </button>
                ) : (
                  <>
                    <Link
                      href={`/login?next=${encodeURIComponent(nextPath)}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-gray-900 text-white font-black text-sm hover:opacity-95"
                    >
                      Log in to join <ArrowRight size={16} />
                    </Link>
                    <div className="text-[11px] text-gray-500 text-center">You’ll return here after logging in.</div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => void refreshMe()}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full border font-bold text-xs",
                    loadingMe ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  )}
                  disabled={loadingMe}
                >
                  {loadingMe ? "Checking…" : "Refresh login status"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
