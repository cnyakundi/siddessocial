"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Users as UsersIcon, Layers as LayersIcon, FileText } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDE_THEMES, SIDES } from "@/src/lib/sides";

// sd_514: Universal search (People + Sets + Public Takes) with tabs and restricted UX.

type TabId = "all" | "people" | "sets" | "takes";

type SetItem = {
  id: string;
  side: SideId;
  label: string;
  members: string[];
  color?: string;
};

type UserItem = {
  id: number;
  username: string;
  handle: string;
  isStaff?: boolean;
};

type PostItem = {
  id: string;
  handle?: string;
  author?: string;
  time?: string;
  content?: string;
  likeCount?: number;
  replyCount?: number;
};

type RestrictedShape = {
  ok?: boolean;
  restricted?: boolean;
  viewer?: string | null;
  role?: string;
  error?: string;
};

type SetsResp = RestrictedShape & { items?: any[] };

type UsersResp = RestrictedShape & { items?: any[]; count?: number };

type PostsResp = RestrictedShape & { items?: any[]; count?: number };

function normQ(q: string): string {
  return String(q || "").trim().toLowerCase();
}

function includesCI(hay: string, needle: string): boolean {
  return String(hay || "").toLowerCase().includes(needle);
}

function safeTab(raw: string): TabId {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "people") return "people";
  if (v === "sets") return "sets";
  if (v === "takes" || v === "posts") return "takes";
  return "all";
}

function prettyCount(n: number): string {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}

export default function SearchPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialQ = useMemo(() => String(sp?.get("q") || ""), [sp]);
  const initialTab = useMemo(() => safeTab(String(sp?.get("tab") || "all")), [sp]);

  const [q, setQ] = useState(initialQ);
  const [tab, setTab] = useState<TabId>(initialTab);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);

  const [bySide, setBySide] = useState<Record<string, SetItem[]>>({});
  const [users, setUsers] = useState<UserItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);

  const qn = useMemo(() => normQ(q), [q]);

  function updateUrl(nextQ: string, nextTab: TabId) {
    const params = new URLSearchParams(sp ? Array.from(sp.entries()) : []);
    if (nextQ) params.set("q", nextQ);
    else params.delete("q");
    if (nextTab && nextTab !== "all") params.set("tab", nextTab);
    else params.delete("tab");
    const qs = params.toString();
    router.replace(qs ? "/search?" + qs : "/search");
  }

  async function fetchSets(side: SideId, useQ: string): Promise<{ items: SetItem[]; restricted: boolean }> {
    const res = await fetch("/api/circles?side=" + side, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as SetsResp;
    const isRestr = Boolean(data?.restricted);
    if (!res.ok) return { items: [], restricted: isRestr };

    const itemsRaw = Array.isArray(data.items) ? data.items : [];
    const mapped: SetItem[] = itemsRaw.map((it: any) => ({
      id: String(it?.id || ""),
      side,
      label: String(it?.label || ""),
      members: Array.isArray(it?.members) ? it.members.map((m: any) => String(m || "")).filter(Boolean) : [],
      color: typeof it?.color === "string" ? it.color : undefined,
    }));

    const filtered = mapped.filter((it) => includesCI(it.label, useQ) || it.members.some((m) => includesCI(m, useQ)));
    return { items: filtered, restricted: isRestr };
  }

  async function fetchUsers(useQ: string): Promise<{ items: UserItem[]; restricted: boolean }> {
    const res = await fetch("/api/search/users?q=" + encodeURIComponent(useQ) + "&limit=20", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as UsersResp;
    const isRestr = Boolean(data?.restricted);
    if (!res.ok) return { items: [], restricted: isRestr };

    const raw = Array.isArray(data.items) ? data.items : [];
    const mapped: UserItem[] = raw
      .map((u: any) => ({
        id: Number(u?.id || 0),
        username: String(u?.username || "").trim(),
        handle: String(u?.handle || "").trim() || (u?.username ? "@" + String(u.username).trim() : ""),
        isStaff: Boolean(u?.isStaff),
      }))
      .filter((u) => u.username);

    return { items: mapped, restricted: isRestr };
  }

  async function fetchPosts(useQ: string): Promise<{ items: PostItem[]; restricted: boolean }> {
    const res = await fetch("/api/search/posts?q=" + encodeURIComponent(useQ) + "&limit=25", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as PostsResp;
    const isRestr = Boolean(data?.restricted);
    if (!res.ok) return { items: [], restricted: isRestr };

    const raw = Array.isArray(data.items) ? data.items : [];
    const mapped: PostItem[] = raw
      .map((p: any) => ({
        id: String(p?.id || ""),
        handle: String(p?.handle || "").trim(),
        author: String(p?.author || "").trim(),
        time: String(p?.time || "").trim(),
        content: String(p?.content || "").trim(),
        likeCount: Number(p?.likeCount || 0),
        replyCount: Number(p?.replyCount || 0),
      }))
      .filter((p) => p.id);

    return { items: mapped, restricted: isRestr };
  }

  async function runSearch(nextQ?: string) {
    const useQ = normQ(typeof nextQ === "string" ? nextQ : q);
    setErr(null);
    updateUrl(useQ, tab);

    if (!useQ) {
      setRestricted(false);
      setUsers([]);
      setPosts([]);
      setBySide({});
      return;
    }

    if (useQ.length < 2) {
      setRestricted(false);
      setUsers([]);
      setPosts([]);
      setBySide({});
      return;
    }

    setLoading(true);
    try {
      const sides: SideId[] = ["friends", "close", "work", "public"];

      const [setsAllSides, usersOut, postsOut] = await Promise.all([
        Promise.all(sides.map((s) => fetchSets(s, useQ))),
        fetchUsers(useQ),
        fetchPosts(useQ),
      ]);

      const nextBySide: Record<string, SetItem[]> = {};
      let anyRestr = false;
      for (let i = 0; i < sides.length; i++) {
        const sid = sides[i];
        const out = setsAllSides[i];
        nextBySide[sid] = out?.items || [];
        anyRestr = anyRestr || Boolean(out?.restricted);
      }

      anyRestr = anyRestr || Boolean(usersOut.restricted) || Boolean(postsOut.restricted);

      setRestricted(anyRestr);
      setBySide(nextBySide);
      setUsers(usersOut.items || []);
      setPosts(postsOut.items || []);
    } catch {
      setErr("Search failed (network).");
      setRestricted(false);
      setUsers([]);
      setPosts([]);
      setBySide({});
    } finally {
      setLoading(false);
    }
  }

  // initial load from URL params
  useEffect(() => {
    const qq = normQ(initialQ);
    if (qq) void runSearch(qq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setsCount = useMemo(() => {
    let n = 0;
    for (const sid of Object.keys(bySide)) n += (bySide[sid] || []).length;
    return n;
  }, [bySide]);

  const totalCount = useMemo(() => users.length + posts.length + setsCount, [users.length, posts.length, setsCount]);

  function switchTab(nextTab: TabId) {
    setTab(nextTab);
    updateUrl(qn, nextTab);
  }

  const tabs: Array<{ id: TabId; label: string; count: number; icon: any }> = useMemo(
    () => [
      { id: "all", label: "All", count: totalCount, icon: Search },
      { id: "people", label: "People", count: users.length, icon: UsersIcon },
      { id: "sets", label: "Sets", count: setsCount, icon: LayersIcon },
      { id: "takes", label: "Takes", count: posts.length, icon: FileText },
    ],
    [totalCount, users.length, setsCount, posts.length]
  );

  const showPeople = tab === "all" || tab === "people";
  const showSets = tab === "all" || tab === "sets";
  const showTakes = tab === "all" || tab === "takes";

  return (
    <div className="min-h-[80vh] px-4 py-10 flex justify-center">
      <div className="w-full max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-black text-gray-900">Search</div>
            <div className="text-sm text-gray-500 mt-1">Universal results (People, Sets, Public Takes).</div>
          </div>
          <Link
            href="/siddes-feed"
            className="px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Back to feed
          </Link>
        </div>

        <div className="mt-6 p-4 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-gray-100 border border-gray-200">
              <Search size={16} className="text-gray-700" />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
              placeholder="Search people, sets, or public takes…"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-300"
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={!qn || loading}
              className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {err ? <div className="text-sm text-rose-600 mt-3">{err}</div> : null}

          {qn ? (
            <div className="mt-3 text-xs text-gray-500 flex items-center justify-between gap-4">
              <div>
                Query: <span className="font-mono">{qn}</span> • Results: <span className="font-bold">{prettyCount(totalCount)}</span>
              </div>
              <div className="text-xs text-gray-400">Tip: Use @handle for people.</div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-gray-500">Tip: Try a set name (e.g., “family”), a handle (e.g., “@ali”), or a public keyword.</div>
          )}
        </div>

        {qn ? (
          <div className="mt-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => switchTab(t.id)}
                    className={
                      "px-4 py-2 rounded-full border text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all " +
                      (active ? "bg-gray-900 text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")
                    }
                  >
                    <Icon size={14} />
                    {t.label}
                    <span className={"ml-1 " + (active ? "text-white/80" : "text-gray-400")}>{prettyCount(t.count)}</span>
                  </button>
                );
              })}
            </div>

            {restricted ? (
              <div className="mt-6 p-6 rounded-2xl border border-amber-200 bg-amber-50">
                <div className="text-lg font-extrabold text-amber-900">Search is restricted</div>
                <div className="text-sm text-amber-900/70 mt-1">
                  Sign in (or enable dev viewer) to search People, Sets, and Public Takes.
                </div>
              </div>
            ) : null}

            {!restricted && totalCount === 0 && !loading ? (
              <div className="mt-6 p-6 rounded-2xl border border-gray-200 bg-white text-center">
                <div className="text-lg font-extrabold text-gray-900">No results</div>
                <div className="text-sm text-gray-500 mt-1">Try a different keyword.</div>
              </div>
            ) : null}

            {!restricted ? (
              <div className="mt-6 space-y-6">
                {/* People */}
                {showPeople && users.length ? (
                  <div className="p-4 rounded-2xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-extrabold text-gray-700">People</span>
                      </div>
                      <div className="text-xs font-bold text-gray-500">{prettyCount(users.length)}</div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {users.slice(0, 25).map((u) => (
                        <Link
                          key={u.id}
                          href={"/u/" + u.username}
                          className="block p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200 transition-all"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-gray-900 truncate">{u.handle}</div>
                              <div className="text-xs text-gray-500 truncate">{u.isStaff ? "Staff" : "User"}</div>
                            </div>
                            <div className="text-xs font-extrabold text-gray-600">Open</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Sets */}
                {showSets && setsCount ? (
                  <div className="space-y-4">
                    {SIDE_ORDER.map((sid) => {
                      const items = bySide[sid] || [];
                      const theme = SIDE_THEMES[sid];
                      if (!items.length) return null;

                      return (
                        <div key={sid} className="p-4 rounded-2xl border border-gray-200 bg-white">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  "px-2 py-1 rounded-full border text-xs font-extrabold " +
                                  theme.lightBg +
                                  " " +
                                  theme.text +
                                  " " +
                                  theme.border
                                }
                              >
                                {SIDES[sid].label}
                              </span>
                              <div className="text-sm font-extrabold text-gray-900">Sets</div>
                            </div>
                            <div className="text-xs font-bold text-gray-500">{prettyCount(items.length)}</div>
                          </div>

                          <div className="mt-3 space-y-2">
                            {items.slice(0, 25).map((it) => (
                              <div key={it.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold text-gray-900 truncate">{it.label}</div>
                                  <div className="text-xs text-gray-500 truncate">
                                    Members: {it.members.slice(0, 6).join(", ")}
                                    {it.members.length > 6 ? " +" + String(it.members.length - 6) + " more" : ""}
                                  </div>
                                </div>
                                <Link
                                  href={"/siddes-circles/" + it.id}
                                  className="px-3 py-2 rounded-full bg-white border border-gray-200 text-xs font-extrabold text-gray-700 hover:bg-gray-100"
                                >
                                  Open
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Public Takes */}
                {showTakes && posts.length ? (
                  <div className="p-4 rounded-2xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-extrabold text-gray-700">Takes</span>
                        <div className="text-xs text-gray-500">(Public only)</div>
                      </div>
                      <div className="text-xs font-bold text-gray-500">{prettyCount(posts.length)}</div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {posts.slice(0, 25).map((p) => (
                        <Link
                          key={p.id}
                          href={"/siddes-post/" + p.id}
                          className="block p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200 transition-all"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-gray-900 truncate">
                                {p.handle || p.author || "Post"} {p.time ? "• " + p.time : ""}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{p.content || ""}</div>
                            </div>
                            <div className="text-xs font-extrabold text-gray-600 whitespace-nowrap">Open</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
