"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Copy, Link2, Share2, Trash2, RefreshCcw } from "lucide-react";
import { toast } from "@/src/lib/toast";

type InviteLinkItem = {
  token: string;
  setId: string;
  setLabel?: string;
  side?: string;
  maxUses: number;
  uses: number;
  expiresAt?: number | null;
  revokedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  status?: "active" | "revoked" | "expired" | "used_up" | string;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function linkUrl(token: string): string {
  if (typeof window === "undefined") return `/i/${encodeURIComponent(token)}`;
  return `${window.location.origin}/i/${encodeURIComponent(token)}`;
}

function fmtShort(ts?: number | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return String(ts);
  }
}

async function j<T>(res: Response): Promise<T> {
  const data = await res.json();
  return data as T;
}

export function InviteLinksPanel({
  setId,
  setLabel,
  canManage,
}: {
  setId: string;
  setLabel?: string;
  canManage: boolean;
}) {
  const safeCircleId = useMemo(() => encodeURIComponent(setId || ""), [setId]);

  const [items, setItems] = useState<InviteLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [maxUses, setMaxUses] = useState(10);
  const [expiresDays, setExpiresDays] = useState(14);

  const refresh = async () => {
    if (!safeCircleId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/circles/${safeCircleId}/invite-links`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setItems([]);
        setErr("Restricted.");
        return;
      }
      if (!res.ok) {
        setItems([]);
        setErr(`Failed to load links (${res.status}).`);
        return;
      }
      const data = await j<any>(res);
      const arr = Array.isArray(data?.items) ? data.items : [];
      const cleaned: InviteLinkItem[] = arr
        .map((x: any) => ({
          token: String(x?.token || ""),
          setId: String(x?.setId || x?.set_id || ""),
          setLabel: typeof x?.setLabel === "string" ? x.setLabel : undefined,
          side: typeof x?.side === "string" ? x.side : undefined,
          maxUses: typeof x?.maxUses === "number" ? x.maxUses : Number(x?.max_uses || 0),
          uses: typeof x?.uses === "number" ? x.uses : Number(x?.uses || 0),
          expiresAt: typeof x?.expiresAt === "number" ? x.expiresAt : null,
          revokedAt: typeof x?.revokedAt === "number" ? x.revokedAt : null,
          createdAt: typeof x?.createdAt === "number" ? x.createdAt : Date.now(),
          updatedAt: typeof x?.updatedAt === "number" ? x.updatedAt : Date.now(),
          status: typeof x?.status === "string" ? x.status : undefined,
        }))
        .filter((x: InviteLinkItem) => Boolean(x.token && x.setId));
      setItems(cleaned);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || "Failed to load links.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCircleId]);

  const create = async () => {
    if (!canManage) return;
    if (!safeCircleId) return;
    setBusy(true);
    setErr(null);
    try {
      const body = { maxUses, expiresDays };
      const res = await fetch(`/api/circles/${safeCircleId}/invite-links`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await j<any>(res).catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        setErr("Restricted.");
        return;
      }
      if (!res.ok || !data?.item?.token) {
        setErr(data?.error ? String(data.error) : `Create failed (${res.status}).`);
        return;
      }
      toast.success("Invite link created");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Create failed.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (token: string) => {
    if (!canManage) return;
    if (!safeCircleId || !token) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/circles/${safeCircleId}/invite-links/${encodeURIComponent(token)}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await j<any>(res).catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ? String(data.error) : `Revoke failed (${res.status}).`);
        return;
      }
      toast.success("Link revoked");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Revoke failed.");
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Copied link");
    } catch {
      toast.error("Copy failed");
    }
  };

  const shareLink = async (url: string, title: string, text: string) => {
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title, text, url });
        return;
      }
    } catch {
      // ignore
    }
    await copyText(url);
  };

  const title = setLabel ? `Join “${setLabel}” on Siddes` : "Join this Circle on Siddes";
  const shareText = setLabel ? `Join my Set: ${setLabel}` : "Join my Set on Siddes";

  return (
    <div className="p-4 rounded-2xl bg-white border border-gray-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-black text-gray-900 flex items-center gap-2">
            <Link2 size={18} /> Invite links
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Share a link that lets people join this Circle. You can cap uses and set an expiry.
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-2 rounded-full border font-bold text-xs",
            loading ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          )}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      {!canManage ? (
        <div className="mt-3 p-3 rounded-2xl border border-gray-200 bg-gray-50 text-gray-700 text-sm">
          Only the Circle owner can create or revoke invite links.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="block">
            <div className="text-[11px] font-bold text-gray-500 mb-1">Max uses</div>
            <input
              type="number"
              min={1}
              max={200}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Math.min(200, Number(e.target.value || 0))))}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            />
          </label>

          <label className="block">
            <div className="text-[11px] font-bold text-gray-500 mb-1">Expires (days)</div>
            <input
              type="number"
              min={0}
              max={365}
              value={expiresDays}
              onChange={(e) => setExpiresDays(Math.max(0, Math.min(365, Number(e.target.value || 0))))}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void create()}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full border font-black text-sm",
                busy ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
              )}
            >
              Create link
            </button>
          </div>
        </div>
      )}

      {err ? (
        <div className="mt-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-800 text-sm">
          <div className="font-black">Error</div>
          <div className="text-xs mt-1">{err}</div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {!items.length ? (
          <div className="p-4 rounded-2xl border border-dashed border-gray-200 text-center">
            <div className="font-black text-gray-900 mb-1">No invite links yet</div>
            <div className="text-sm text-gray-500">Create one to share this Circle.</div>
          </div>
        ) : (
          items.map((l) => {
            const url = linkUrl(l.token);
            const status = l.status || "active";
            const badge =
              status === "active"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : status === "revoked"
                  ? "bg-gray-50 text-gray-700 border-gray-200"
                  : "bg-amber-50 text-amber-900 border-amber-200";

            return (
              <div key={l.token} className="p-3 rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={cn("text-[11px] px-2 py-0.5 rounded-full border font-black", badge)}>
                        {status.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-gray-500 font-mono break-all">{l.token}</div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Uses: <span className="font-mono">{l.uses}/{l.maxUses}</span>
                      {l.expiresAt ? (
                        <>
                          {" "}• Expires: <span className="font-mono">{fmtShort(l.expiresAt)}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-gray-700 font-mono break-all">{url}</div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full border border-gray-300 bg-white text-gray-900 font-bold text-xs hover:bg-gray-50"
                      onClick={() => void copyText(url)}
                    >
                      <Copy size={14} /> Copy
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full border border-gray-300 bg-white text-gray-900 font-bold text-xs hover:bg-gray-50"
                      onClick={() => void shareLink(url, title, shareText)}
                    >
                      <Share2 size={14} /> Share
                    </button>

                    {canManage ? (
                      <button
                        type="button"
                        disabled={busy || status === "revoked"}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full border font-bold text-xs",
                          busy || status === "revoked"
                            ? "bg-gray-100 text-gray-400 border-gray-200"
                            : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                        )}
                        onClick={() => void revoke(l.token)}
                      >
                        <Trash2 size={14} /> Revoke
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
