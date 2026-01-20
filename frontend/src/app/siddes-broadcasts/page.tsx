"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radio, Search, RefreshCcw, Bell } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type BroadcastItem = {
  id: string;
  name: string;
  handle: string;
  category: string;
  desc: string;
  subscribers: number;
  isFollowing: boolean;
  hasUnread: boolean;
  lastUpdate?: string;
};

export default function SiddesBroadcastsPage() {
  const router = useRouter();
  const { side, setSide } = useSide();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [requestedPublic, setRequestedPublic] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (side === "public") return;
    if (requestedPublic) return;
    setRequestedPublic(true);
    setSide("public", { afterCancel: () => router.replace("/siddes-feed") });
  }, [hydrated, side, requestedPublic, setSide, router]);

  const theme = SIDE_THEMES["public"];

  const [tab, setTab] = useState<"following" | "discover">("following");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const url = new URL("/api/broadcasts", window.location.origin);
      url.searchParams.set("tab", tab);
      if (q.trim()) url.searchParams.set("q", q.trim());

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.restricted || res.status === 401 || res.status === 403) {
        setRestricted(true);
        setItems([]);
        return;
      }
      setRestricted(false);
      if (!res.ok) throw new Error(data?.error || "Failed to load broadcasts");

      const arr = Array.isArray(data?.items) ? data.items : [];
      setItems(arr);
    } catch (e: any) {
      setErr(e?.message || "Failed to load broadcasts");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || side !== "public") return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hydrated, side]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((b) => (b.name || "").toLowerCase().includes(t) || (b.handle || "").toLowerCase().includes(t) || (b.desc || "").toLowerCase().includes(t));
  }, [items, q]);

  const toggleFollow = async (b: BroadcastItem) => {
    setErr(null);
    try {
      const endpoint = b.isFollowing ? `/api/broadcasts/${encodeURIComponent(b.id)}/unfollow` : `/api/broadcasts/${encodeURIComponent(b.id)}/follow`;
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (data?.restricted || res.status === 401 || res.status === 403) {
        setRestricted(true);
        return;
      }

      if (!res.ok) throw new Error(data?.error || "Action failed");

      const item = (data?.item as BroadcastItem | undefined);
      if (item && item.id) {
        setItems((prev) => prev.map((x) => (x.id === item.id ? item : x)));
      } else {
        await load();
      }
    } catch (e: any) {
      setErr(e?.message || "Action failed");
    }
  };
  if (hydrated && side !== "public") {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="md:hidden">
            <div className="text-sm font-extrabold text-gray-900">Broadcasts</div>
            <div className="text-xs text-gray-500">Public channels you follow. Calm, high-signal.</div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
  {restricted ? (
    <Link href="/login?next=%2Fsiddes-broadcasts" className="px-3 py-2 rounded-full bg-blue-600 text-white font-bold text-sm hover:opacity-95">
      Login
    </Link>
  ) : (
    <Link href="/siddes-broadcasts/create" className="px-3 py-2 rounded-full bg-blue-600 text-white font-bold text-sm hover:opacity-95">
      Create
    </Link>
  )}
  <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
</div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setTab("following")}
              className={cn(
                "px-3 py-2 text-xs font-extrabold rounded-lg transition-all",
                tab === "following" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              )}
            >
              Following
            </button>
            <button
              onClick={() => setTab("discover")}
              className={cn(
                "px-3 py-2 text-xs font-extrabold rounded-lg transition-all",
                tab === "discover" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              )}
            >
              Discover
            </button>
          </div>

          <div className="flex-1" />

          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search broadcasts"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 pl-9 text-sm outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {err ? <div className="text-sm text-rose-600 mb-3">{err}</div> : null}

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {restricted ? (
            <div className="p-10 text-center text-sm text-amber-700" data-testid="broadcasts-restricted">
              This list is restricted. Please sign in.
              <div className="mt-3">
                <Link href="/login" className="inline-flex px-4 py-2 rounded-full bg-gray-900 text-white font-extrabold text-sm">Go to Login</Link>
              </div>
            </div>
          ) : loading ? (
            <div className="p-10 text-center text-sm text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              {tab === "following" ? "You are not following any broadcasts yet." : "No broadcasts found."}
            </div>
          ) : (
            filtered.map((b) => (
              <div key={b.id} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", theme.lightBg, theme.text)}>
                    <Radio size={22} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 ml-auto">
                          <Link href={`/siddes-broadcasts/${encodeURIComponent(b.id)}`} className="font-extrabold text-gray-900 truncate hover:underline">
                            {b.name}
                          </Link>
                          {b.hasUnread ? <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} title="New updates" /> : null}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{b.handle} • {b.category || "General"} • {b.subscribers} followers</div>
                      </div>

                      <button
                        onClick={() => void toggleFollow(b)}
                        className={cn(
                          "px-3 py-2 rounded-full text-xs font-extrabold border",
                          b.isFollowing ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50" : cn(theme.primaryBg, "text-white border-transparent hover:opacity-95")
                        )}
                      >
                        {b.isFollowing ? "Following" : "Follow"}
                      </button>
                    </div>

                    <div className="text-sm text-gray-700 mt-2 line-clamp-2">{b.desc}</div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                        {b.lastUpdate ? `Updated ${b.lastUpdate} ago` : ""}
                      </div>
                      <div className="text-gray-300 flex items-center gap-2" title="Notifications are in the Butler Tray">
                        <Bell size={16} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
