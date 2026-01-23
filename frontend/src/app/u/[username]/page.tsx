"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { MoreHorizontal } from "lucide-react";

import { SIDES, type SideId } from "@/src/lib/sides";
import {
  CopyLinkButton,
  PrismIdentityCard,
  PrismSideTabs,
  SideActionButtons,
  SideWithSheet,
  type ProfileViewPayload,
} from "@/src/components/PrismProfile";

import { ProfileActionsSheet } from "@/src/components/ProfileActionsSheet";
import { toast } from "@/src/lib/toast";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export default function UserProfilePage() {
  const params = useParams() as { username?: string };
  const raw = String(params?.username || "");

  const username = useMemo(() => {
    const s = decodeURIComponent(raw || "").trim();
    if (!s) return "";
    return s.startsWith("@") ? s : s;
  }, [raw]);

  const handle = useMemo(() => {
    if (!username) return "";
    return username.startsWith("@") ? username : `@${username}`;
  }, [username]);

  const [data, setData] = useState<ProfileViewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [activeIdentitySide, setActiveIdentitySide] = useState<SideId>("public");

  const [sideSheet, setSideSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const [actionsOpen, setActionsOpen] = useState(false); // sd_424_profile_actions

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!handle) {
        setErr("missing_handle");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const qs = activeIdentitySide ? `?side=${encodeURIComponent(activeIdentitySide)}` : "";
        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}${qs}`, { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as any;
        if (!mounted) return;

        if (!j || typeof j !== "object" || !j.ok) {
          setData(j && typeof j === "object" ? j : { ok: false, error: "bad_response" });
          setErr(j?.error || "not_found");
        } else {
          const nextSide = (j?.requestedSide || j?.viewSide || "public") as SideId;
          setActiveIdentitySide(nextSide);
          setData(j as ProfileViewPayload);
        }
      } catch {
        if (!mounted) return;
        setErr("network_error");
        setData({ ok: false, error: "network_error" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [handle, activeIdentitySide]);

  const viewSide = (data?.viewSide || "public") as SideId;
  const displaySide = ((data as any)?.requestedSide || viewSide) as SideId;
  const allowedSides = ((data as any)?.allowedSides || ["public"]) as SideId[];
  const facet = data?.facet;
  const user = data?.user;

  const isOwner = !!(data as any)?.isOwner;

  const viewerSidedAs = (data?.viewerSidedAs || null) as SideId | null;
  const sharedSets = data?.sharedSets || [];


  const doToggleSubscribe = async () => {
    if (!user?.handle) return;
    const want = !((data as any)?.viewerSubscribes);
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: user.handle, follow: want }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 401 ? "Log in to subscribe." : res.status === 429 ? "Slow down." : "Could not update subscription.";

        toast.error(msg);
        throw new Error(msg);
      }
      setData((prev) => {
        if (!prev || !prev.ok) return prev;
        return {
          ...(prev as any),
          viewerSubscribes: !!j.following,
} as any;
      });
    } finally {
      setBusy(false);
    }
  };

  const doPickSide = async (side: SideId | "public") => {
    if (!user?.handle) return;

    setBusy(true);
    try {
      const res = await fetch("/api/side", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: user.handle, side }),
      });
      const j = (await res.json().catch(() => null)) as any;

      if (!res.ok || !j || j.ok !== true) {
        let msg = res.status === 429 ? "Slow down." : "Could not update Side.";
        if (j?.error === "friends_required") msg = "Friends first (then Close).";
        if (res.status === 401 || j?.error === "restricted") msg = "Login required.";
        toast.error(msg);
        throw new Error(msg);
      }

      setData((prev) => {
        if (!prev || !prev.ok) return prev;
        return { ...prev, viewerSidedAs: j.side || null } as any;
      });
    } finally {
      setBusy(false);
    }
  };



  const href = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <div className="h-5 w-40 bg-gray-100 rounded" />
            <div className="h-4 w-64 bg-gray-100 rounded mt-3" />
            <div className="h-4 w-56 bg-gray-100 rounded mt-2" />
          </div>
        ) : !data?.ok || !facet || !user ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <div className="text-sm font-black text-gray-900">Profile not available</div>
            <div className="text-xs text-gray-500 mt-1">{err || "not_found"}</div>
          </div>
        ) : (
          <>
            <PrismSideTabs
              active={displaySide}
              allowedSides={allowedSides}
              onPick={(side) => {
                if (!allowedSides.includes(side)) {
                  toast.error("Locked.");
                  return;
                }
                setActiveIdentitySide(side);
              }}
            />


            /* sd_537: relationship clarity */
            {!isOwner ? (
              <div className="mt-3 mb-4 flex flex-wrap gap-2 text-xs font-extrabold">
                <div className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700">
                  Access: <span className="text-gray-900">{SIDES[viewSide]?.label || viewSide}</span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700">
                  You Sided: <span className="text-gray-900">{viewerSidedAs ? (SIDES[viewerSidedAs]?.label || viewerSidedAs) : "Not set"}</span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700">
                  Public: <span className="text-gray-900">{(data as any)?.viewerSubscribes ? "Subscribed" : "Not subscribed"}</span>
                </div>
              </div>
            ) : null}

            <PrismIdentityCard
              viewSide={displaySide}
              handle={user.handle}
              facet={facet}
              siders={data?.siders ?? null}
              sharedSets={sharedSets}
actions={
                isOwner ? (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          window.location.href = "/siddes-profile/prism";
                        } catch {}
                      }}
                      className="w-full py-2.5 rounded-xl font-extrabold text-sm text-white shadow-md active:scale-95 transition-all bg-slate-800 hover:bg-slate-900"
                    >
                      Edit identities
                    </button>
                    <div className="flex gap-3">
                      <CopyLinkButton href={href} />
                      <button
                        type="button"
                        onClick={() => setActionsOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-extrabold text-sm hover:bg-gray-200 transition-all flex items-center gap-2"
                        aria-label="More actions"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          await doToggleSubscribe();
                        }}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl font-extrabold text-sm shadow-md active:scale-95 transition-all",
                          (data as any)?.viewerSubscribes ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : "bg-blue-600 text-white hover:bg-blue-700",
                          busy ? "opacity-80 cursor-not-allowed" : ""
                        )}
                      >
                        {(data as any)?.viewerSubscribes ? "Unsubscribe" : "Subscribe"}
                      </button>
                      <SideActionButtons viewerSidedAs={viewerSidedAs} onOpenSheet={() => setSideSheet(true)} />
                    </div>
                    <div className="flex gap-3">
                      <CopyLinkButton href={href} />
                      <button
                        type="button"
                        onClick={() => setActionsOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-extrabold text-sm hover:bg-gray-200 transition-all flex items-center gap-2"
                        aria-label="More actions"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>
                )
              }
            />
            {!isOwner ? (
            <SideWithSheet
              open={sideSheet}
              onClose={() => setSideSheet(false)}
              current={viewerSidedAs}
              busy={busy}
              follow={{
                following: !!(data as any)?.viewerSubscribes,
busy,
                onToggle: doToggleSubscribe,
              }}
              onPick={doPickSide}
            />
            ) : null}

            <ProfileActionsSheet
              open={actionsOpen}
              onClose={() => setActionsOpen(false)}
              handle={user.handle}
              displayName={facet.displayName || user.handle}
              href={href}
            />
            

                      </>
        )}
      </div>
    </div>
  );
}
