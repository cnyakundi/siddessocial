"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";

type FollowItem = {
  id: number;
  handle: string;
  displayName?: string;
  avatarImage?: string | null;
};

type FollowResp = {
  ok: boolean;
  error?: string;
  hidden?: boolean;
  items?: FollowItem[];
  nextCursor?: string | null;
  total?: number | null;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function initialsFrom(nameOrHandle: string) {
  const s = String(nameOrHandle || "").replace(/^@/, "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return (parts[0][0] || "U").toUpperCase();
  return ((parts[0][0] || "U") + (parts[parts.length - 1][0] || "U")).toUpperCase();
}

function handleSlug(handle: string) {
  const raw = String(handle || "").trim();
  const u = raw.replace(/^@/, "").split(/\s+/)[0]?.trim() || "";
  return u || "";
}

function profileHref(handle: string) {
  const u = handleSlug(handle);
  return u ? `/u/${encodeURIComponent(u)}` : "#";
}

function Avatar({ item }: { item: { handle: string; displayName?: string; avatarImage?: string | null } }) {
  const label = (item.displayName || "").trim() || item.handle || "User";
  const url = String(item.avatarImage || "").trim();
  const initials = initialsFrom(label);
  return (
    <div className="w-11 h-11 rounded-full overflow-hidden border border-gray-200 bg-gray-50 shrink-0 flex items-center justify-center">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs font-black text-gray-700">{initials}</span>
      )}
    </div>
  );
}

export default function PublicFollowingPage() {
  const params = useParams() as { username?: string };
  const router = useRouter();

  const raw = String(params?.username || "");
  const username = useMemo(() => decodeURIComponent(raw || "").replace(/^@/, "").trim(), [raw]);
  const handle = useMemo(() => (username ? `@${username}` : ""), [username]);

  const [items, setItems] = useState<FollowItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string | null) => {
      if (!handle) return;
      const isMore = !!cursor;
      if (isMore) setLoadingMore(true);
      else setLoading(true);

      setTrouble(null);
      setHidden(false);
      try {
        const qs = new URLSearchParams();
        qs.set("limit", "40");
        if (cursor) qs.set("cursor", cursor);

        const res = await fetch(`/api/public-following/${encodeURIComponent(handle)}?${qs.toString()}`, { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as any as FollowResp;

        if (!res.ok || !j || j.ok !== true) {
          setTrouble(j?.error || (res.status === 404 ? "not_found" : "request_failed"));
          if (!isMore) setItems([]);
          return;
        }
const isHidden = !!(j as any).hidden;
setHidden(isHidden);


        const got = Array.isArray(j.items) ? j.items : [];
        setTotal(typeof j.total === "number" ? j.total : null);
        setNextCursor(String(j.nextCursor || "").trim() || null);
if (isHidden) {
  setItems([]);
  setNextCursor(null);
  return;
}


        setItems((prev) => {
          if (!isMore) return got;
          const seen = new Set<number>(prev.map((x) => Number(x.id)));
          const merged = [...prev];
          for (const it of got) {
            const id = Number((it as any)?.id);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            merged.push(it);
          }
          return merged;
        });
      } catch {
        setTrouble("network_error");
      } finally {
        if (isMore) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [handle]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const backHref = username ? `/u/${encodeURIComponent(username)}` : "/siddes-feed";

  return (
    <div className="min-h-dvh">
      <div className="px-4 pt-4 pb-3 sticky top-0 z-10 bg-[#F8F9FA]/90 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              try {
                router.push(backHref);
              } catch {}
            }}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-700 hover:text-gray-900"
            aria-label="Back to profile"
          >
            <ChevronLeft size={18} /> Back
          </button>

          <div className="text-xs font-extrabold text-gray-500">{handle || ""}</div>
        </div>

        <div className="mt-3">
          <div className="text-lg font-black text-gray-900 flex items-center gap-2">Following {hidden ? <Lock size={16} className="text-gray-300" /> : null}</div>
          <div className="text-xs text-gray-500 mt-1">
            Public following (does not grant Friends/Close/Work access).{" "}
            {typeof total === "number" ? <span className="font-mono">Total: {total}</span> : null}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-[520px] mx-auto">
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : trouble ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-black text-red-800">Couldn’t load following</div>
            <div className="text-xs text-red-700 mt-1">Try refreshing.</div>
          </div>
        ) : hidden ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-black text-gray-900">
              <Lock size={16} className="text-gray-400" /> This list is hidden
            </div>
            <div className="text-xs text-gray-500 mt-1">Only the owner can see the names. Counts may still be visible.</div>
          </div>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map((it) => {
              const href = profileHref(it.handle);
              const label = (it.displayName || "").trim() || it.handle || "User";
              return (
                <Link
                  key={String(it.id)}
                  href={href}
                  className="block rounded-2xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors"
                  aria-label={`Open profile ${label}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar item={it} />
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-gray-900 truncate">{label}</div>
                      <div className="text-xs text-gray-500 font-mono truncate">{it.handle}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Not following anyone yet.</div>
        )}

        {nextCursor && !trouble ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void load(nextCursor)}
              disabled={loadingMore}
              className={cn(
                "w-full px-4 py-3 rounded-2xl font-extrabold text-sm border transition-all",
                loadingMore ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
              )}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


// sd_940_fix_hidden_list_pages_v2


// sd_940_fix_hidden_list_pages_v3
