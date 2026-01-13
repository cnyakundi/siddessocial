"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import { getInviteProvider, type InviteAction, type SetInvite } from "@/src/lib/inviteProvider";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export default function InviteAcceptPage({ params }: { params: { id: string } }) {
  const inviteId = decodeURIComponent(params.id || "");
  const invites = useMemo(() => getInviteProvider(), []);

  const [item, setItem] = useState<SetInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const got = await invites.get(inviteId);
      setItem(got);
    } catch (e: any) {
      setErr(e?.message || "Failed to load invite.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteId]);

  function escapeCookieName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-]/g, "\\$&");
  }

  function getCookie(name: string): string | undefined {
    if (typeof document === "undefined") return undefined;
    const m = document.cookie.match(new RegExp(`(?:^|; )${escapeCookieName(name)}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  const viewer = getCookie("sd_viewer");
  const hasCookie = Boolean(viewer);

  const act = async (a: InviteAction) => {
    if (!item) return;
    setActioning(true);
    setErr(null);
    try {
      const nxt = await invites.act(item.id, a);
      if (!nxt) {
        setErr("Invite not found.");
        return;
      }
      setItem(nxt);
      if (a === "accept") setDone("Accepted");
      else if (a === "reject") setDone("Rejected");
      else setDone("Revoked");
    } catch (e: any) {
      setErr(e?.message || "Action failed.");
    } finally {
      setActioning(false);
    }
  };

  const canAcceptReject = Boolean(viewer && item && viewer === item.to && item.status === "pending");
  const canRevoke = Boolean(viewer && item && viewer === item.from && item.status === "pending");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
	        <div className="flex items-center justify-between mb-4">
	          <Link href="/siddes-feed" className="text-sm font-bold text-gray-700 hover:underline">
	            ← Feed
	          </Link>
	          <div className="flex items-center gap-3">
	            <Link href="/siddes-invites" className="text-sm font-bold text-gray-700 hover:underline">
	              Invites
	            </Link>
	            <Link href="/siddes-sets" className="text-sm font-bold text-gray-700 hover:underline">
	              Sets
	            </Link>
	          </div>
	        </div>

        <h1 className="text-2xl font-black text-gray-900 mb-2">Set Invite</h1>
        <div className="text-xs text-gray-500 font-mono mb-4 break-all">{inviteId}</div>

        {!hasCookie ? (
          <div className="mb-4 p-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
            <div className="font-bold mb-1">sd_viewer is missing.</div>
            <div className="text-xs leading-relaxed">
              Stub invites require a viewer cookie/header.
              <span className="block mt-2 font-mono">
                document.cookie = "sd_viewer=@your_handle; Path=/; SameSite=Lax";
              </span>
            </div>
          </div>
        ) : null}

        {err ? (
          <div className="mb-4 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
            <div className="font-bold">Error</div>
            <div className="text-xs mt-1">{err}</div>
          </div>
        ) : null}

	        <div className="p-4 rounded-2xl bg-white border border-gray-200">
	          {done ? (
	            <div
	              className={cn(
	                "mb-3 p-3 rounded-2xl border text-sm",
	                done === "Accepted"
	                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
	                  : done === "Rejected" || done === "Revoked"
	                    ? "border-gray-200 bg-gray-50 text-gray-700"
	                    : "border-gray-200 bg-gray-50 text-gray-700"
	              )}
	            >
	              <div className="font-black">{done}</div>
	              <div className="text-xs mt-1">
	                You can always review invites in <Link className="font-bold hover:underline" href="/siddes-invites">/siddes-invites</Link>.
	              </div>
	            </div>
	          ) : null}
          {loading ? <div className="text-sm text-gray-500 font-bold">Loading…</div> : null}

          {!loading && !item ? (
            <div className="text-sm text-gray-600">Invite not found (or restricted).</div>
          ) : null}

          {item ? (
            <>
              <div className="text-sm text-gray-700">
                <div className="font-black text-gray-900 mb-1">{item.from} invited {item.to}</div>
                <div className="text-xs text-gray-500">
                  Set:{" "}
                  {item.setLabel ? (
                    <>
                      <span className="font-black text-gray-900">{item.setLabel}</span>
                      <span className="ml-1 font-mono text-[11px] text-gray-400">{item.setId.slice(0, 10)}…</span>
                    </>
                  ) : (
                    <span className="font-mono">{item.setId}</span>
                  )}
                  {" "}• Side: <span className="font-mono">{item.side}</span>
                </div>
                {item.message ? <div className="text-xs text-gray-600 mt-2">“{item.message}”</div> : null}
              </div>

	              {done ? (
	                <div
	                  className={cn(
	                    "mt-4 p-3 rounded-2xl border text-sm",
	                    done === "Accepted"
	                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
	                      : done === "Rejected"
	                        ? "border-gray-200 bg-gray-50 text-gray-700"
	                        : "border-amber-200 bg-amber-50 text-amber-800"
	                  )}
	                >
	                  <div className="font-black">{done}</div>
	                  <div className="text-xs mt-1">
	                    Back to{" "}
	                    <Link href="/siddes-invites" className="font-bold hover:underline">
	                      Invites
	                    </Link>
	                    .
	                  </div>
	                </div>
	              ) : null}

	              {canAcceptReject ? (
	                <div className="mt-4 flex gap-2">
	                  <button
	                    type="button"
	                    disabled={actioning}
	                    onClick={() => void act("reject")}
	                    className={cn(
	                      "flex-1 px-3 py-2 rounded-full border font-bold text-sm",
	                      actioning
	                        ? "bg-gray-100 text-gray-400 border-gray-200"
	                        : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
	                    )}
	                  >
	                    Reject
	                  </button>
	                  <button
	                    type="button"
	                    disabled={actioning}
	                    onClick={() => void act("accept")}
	                    className={cn(
	                      "flex-1 px-3 py-2 rounded-full border font-bold text-sm",
	                      actioning
	                        ? "bg-gray-100 text-gray-400 border-gray-200"
	                        : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
	                    )}
	                  >
	                    Accept
	                  </button>
	                </div>
	              ) : null}

	              {canRevoke ? (
	                <div className="mt-4">
	                  <button
	                    type="button"
	                    disabled={actioning}
	                    onClick={() => void act("revoke")}
	                    className={cn(
	                      "w-full px-3 py-2 rounded-full border font-bold text-sm",
	                      actioning
	                        ? "bg-gray-100 text-gray-400 border-gray-200"
	                        : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
	                    )}
	                  >
	                    Revoke invite
	                  </button>
	                </div>
	              ) : null}

	              {!canAcceptReject && !canRevoke && item.status === "pending" ? (
	                <div className="mt-4 text-xs text-gray-500">
	                  This invite is pending, but your current <span className="font-mono">sd_viewer</span> doesn’t match the sender or recipient.
	                </div>
	              ) : null}

	              <div className="mt-3 text-xs text-gray-500">
	                Status: <span className="font-mono">{item.status}</span>
	                {viewer ? <span className="ml-2">viewer: <span className="font-mono">{viewer}</span></span> : null}
	              </div>
{item.status === "accepted" ? (
  <div className="mt-4">
    <Link
      href={`/siddes-sets/${encodeURIComponent(item.setId)}`}
      className="inline-flex items-center justify-center w-full px-3 py-2 rounded-full bg-gray-900 text-white font-black text-sm hover:opacity-95"
    >
      Open Set
    </Link>
  </div>
) : null}

            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
