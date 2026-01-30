export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { headers } from "next/headers";
import InviteLinkClient from "./client";

type ApiResp = { ok?: boolean; valid?: boolean; reason?: string; item?: any };

function originFromHeaders(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

async function fetchInvite(token: string): Promise<ApiResp | null> {
  const t = encodeURIComponent(String(token || "").trim());
  if (!t) return null;
  const origin = originFromHeaders();
  const url = new URL(`/api/invite-links/${t}`, origin).toString();
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as ApiResp;
    return data || null;
  } catch {
    return null;
  }
}

function excerpt(raw: string, max = 160): string {
  const s = String(raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const token = String(params?.token || "").trim();
  const got = await fetchInvite(token);
  const item = got?.item || null;
  const label = typeof item?.setLabel === "string" && item.setLabel ? item.setLabel : "a Circle";
  const ownerHandle = item?.owner?.handle ? String(item.owner.handle) : "";

  const title = ownerHandle ? `${ownerHandle} invited you to ${label}` : `Invite to ${label}`;
  const desc = excerpt(`Join ${label} on Siddes.`, 180);

  return {
    title,
    description: desc || "Join this Circle on Siddes.",
  };
}

export default async function InviteLinkPage({ params }: { params: { token: string } }) {
  const token = String(params?.token || "").trim();
  const initial = await fetchInvite(token);
  return <InviteLinkClient token={token} initial={initial} />;
}
