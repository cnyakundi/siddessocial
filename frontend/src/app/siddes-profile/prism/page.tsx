"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDE_THEMES } from "@/src/lib/sides";
import { useSide } from "@/src/components/SideProvider";

import {
  CopyLinkButton,
  EditFacetButton,
  OwnerTopRow,
  PrismFacetEditSheet,
  PrismIdentityCard,
  type PrismFacet,
  type PrismOwnerPayload,
} from "@/src/components/PrismProfile";

type MePayload = {
  ok?: boolean;
  authenticated?: boolean;
  user?: { id: number; username: string; email: string };
  error?: string;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export default function SiddesProfilePage() {
  const { side } = useSide();

  const [me, setMe] = useState<MePayload | null>(null);
  const [prism, setPrism] = useState<PrismOwnerPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [previewSide, setPreviewSide] = useState<SideId>(side);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setPreviewSide(side);
  }, [side]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      try {
        const [meRes, prismRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/prism", { cache: "no-store" }),
        ]);

        const meJson = (await meRes.json().catch(() => null)) as any;
        const prismJson = (await prismRes.json().catch(() => null)) as any;

        if (!mounted) return;

        setMe(meJson && typeof meJson === "object" ? meJson : { ok: false, error: "bad_me" });
        setPrism(prismJson && typeof prismJson === "object" ? prismJson : { ok: false, error: "bad_prism" });
      } catch {
        if (!mounted) return;
        setMe({ ok: false, error: "network_error" });
        setPrism({ ok: false, error: "network_error" } as any);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const authed = !!me?.authenticated;
  const username = me?.user?.username || "";
  const handle = username ? `@${username}` : "@you";

  const items = (prism?.items || []).filter(Boolean) as PrismFacet[];
  const facet = useMemo(() => items.find((f) => f.side === previewSide) || null, [items, previewSide]);

  const shareHref = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    return `${base}/u/${encodeURIComponent(username || "you")}`;
  }, [username]);

  const saveFacet = async (patch: {
    side: SideId;
    displayName: string;
    headline: string;
    bio: string;
    location: string;
    website: string;
    coverImage: string;
    avatarImage: string;
    anthem: { title: string; artist: string };
    pulse: { label: string; text: string };
    avatarMediaKey?: string;
  }) => {
    const res = await fetch("/api/prism", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });

    const j = (await res.json().catch(() => null)) as any;
    if (!j || !j.ok) throw new Error(j?.error || "save_failed");

    const updated = j.item as PrismFacet;
    setPrism((prev) => {
      const base = prev && typeof prev === "object" ? prev : ({ ok: true } as any);
      const cur = (base.items || []).filter(Boolean) as PrismFacet[];
      const next = cur.map((x) => (x.side === updated.side ? updated : x));
      if (!next.find((x) => x.side === updated.side)) next.push(updated);
      return { ...base, ok: true, items: next } as any;
    });
  };

  const activeTheme = SIDE_THEMES[previewSide];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <div className="h-5 w-44 bg-gray-100 rounded" />
            <div className="h-4 w-72 bg-gray-100 rounded mt-3" />
            <div className="h-4 w-56 bg-gray-100 rounded mt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <div className="text-sm font-black text-gray-900">Not signed in</div>
            <div className="text-xs text-gray-500 mt-1">Login to manage your Prism Profile.</div>
            <div className="mt-4">
              <Link href="/login" className="inline-flex px-4 py-2.5 rounded-xl text-sm font-extrabold bg-gray-900 text-white">
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ensure we have all 4 facets locally (truthful empty states)
  const bySide: Record<SideId, PrismFacet> = (() => {

    const base: any = {};
    for (const s of SIDE_ORDER) {
      const f = items.find((x) => x.side === s);
      base[s] = f || {
        side: s,
        displayName: "",
        headline: "",
        bio: "",
        location: "",
        website: "",
        anthem: null,
        pulse: null,
      };
    }
    return base as any;
  })();

  const effectiveFacet = facet || bySide[previewSide];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-black text-gray-900">Prism Profile</div>
            <div className="text-xs text-gray-500 mt-1">4 identities, 1 user. Relationship decides what others see.</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/siddes-profile/account" className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50">
              Account
            </Link>
            <Link href="/siddes-settings" className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50">
              Settings
            </Link>
          </div>
        </div>

        <OwnerTopRow username={username} previewSide={previewSide} setPreviewSide={setPreviewSide} />

        <div className="mt-4">
          <PrismIdentityCard
            viewSide={previewSide}
            handle={handle}
            facet={effectiveFacet}
            actions={
              <div className="flex gap-3">
                <EditFacetButton onClick={() => setEditOpen(true)} />
                <CopyLinkButton href={shareHref} label="Copy profile" />
              </div>
            }
          />
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Tip: Only you can preview identities. Viewers cannot toggle; they see the identity your relationship grants.
        </div>

        <PrismFacetEditSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          side={previewSide}
          facet={effectiveFacet}
          onSave={saveFacet}
        />

        {/* Safety: never use blue for private actions */}
        <div className={cn("hidden", activeTheme.primaryBg)} aria-hidden="true" />
      </div>
    </div>
  );
}
