"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { MoreHorizontal } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import {
  CopyLinkButton,
  PrismIdentityCard,
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
        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`, { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as any;
        if (!mounted) return;

        if (!j || typeof j !== "object" || !j.ok) {
          setData(j && typeof j === "object" ? j : { ok: false, error: "bad_response" });
          setErr(j?.error || "not_found");
        } else {
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
  }, [handle]);

  const viewSide = (data?.viewSide || "public") as SideId;
  const facet = data?.facet;
  const user = data?.user;

  const viewerSidedAs = (data?.viewerSidedAs || null) as SideId | null;
  const sharedSets = data?.sharedSets || [];

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
        const msg = res.status === 429 ? "Slow down." : "Could not update Side.";
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
            <PrismIdentityCard
              viewSide={viewSide}
              handle={user.handle}
              facet={facet}
              siders={data?.siders ?? null}
              sharedSets={sharedSets}
              actions={
                <div className="flex gap-3">
                  <SideActionButtons viewerSidedAs={viewerSidedAs} onOpenSheet={() => setSideSheet(true)} />
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
              }
            />

            <SideWithSheet
              open={sideSheet}
              onClose={() => setSideSheet(false)}
              current={viewerSidedAs}
              busy={busy}
              onPick={doPickSide}
            />

            <ProfileActionsSheet
              open={actionsOpen}
              onClose={() => setActionsOpen(false)}
              handle={user.handle}
              displayName={facet.displayName || user.handle}
              href={href}
            />
            

            <div className="mt-4 text-xs text-gray-500">
              You are viewing <span className="font-extrabold text-gray-700">{viewSide}</span> identity. Viewers cannot toggle identity.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
