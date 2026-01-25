"use client";

import Link from "next/link";

// sd_719_fix_search_p_undefined: remove stray data-post-id={p.id} in search results
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon, Users as UsersIcon, Layers as LayersIcon, FileText, X, Lock } from "lucide-react";

import { useSide } from "@/src/components/SideProvider";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import { PUBLIC_CHANNELS } from "@/src/lib/publicChannels";

import { saveReturnScroll, useReturnScrollRestore } from "@/src/hooks/returnScroll";

type TabId = "all" | "people" | "sets" | "posts";

type RestrictedShape = {
  ok?: boolean;
  restricted?: boolean;
  viewer?: string | null;
  role?: string;
  error?: string;
};

type SetItem = { id: string; label: string; members: string[] };
type SetsResp = RestrictedShape & { items?: any[] };

type UserItem = { id: number; username: string; handle: string; isStaff?: boolean };
type UsersResp = RestrictedShape & { items?: any[]; count?: number };

type PostItem = { id: string; handle?: string; author?: string; time?: string; content?: string };
type PostsResp = RestrictedShape & { items?: any[]; count?: number };

type NavItem = { key: string; href: string; kind: "people" | "sets" | "posts"; primary: string; secondary?: string };

function normQ(q: string): string {
  return String(q || "").trim();
}
function safeTab(raw: string): TabId {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "people") return "people";
  if (v === "sets") return "sets";
  if (v === "posts" || v === "takes") return "posts";
  return "all";
}

/**
 * Escape a string for RegExp usage.
 * (We avoid the classic /[.*+?^${}()|[\]\\]/g in patch scripts, and keep it stable here.)
 */
function escapeRegExp(str: string) {
  return String(str || "")
    .replace(/[.*+?^()|[\]\\]/g, "\\$&")
    .replace(/\$/g, "\\$")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}");
}

function highlight(text: string, q: string) {
  const t = String(text || "");
  const qq = String(q || "").trim();
  if (!qq || qq.length < 2) return t;

  const re = new RegExp(escapeRegExp(qq), "ig");
  const matches = t.match(re);
  if (!matches || matches.length === 0) return t;

  const parts = t.split(re);
  const out: any[] = [];

  for (let i = 0; i < parts.length; i++) {
    out.push(parts[i]);
    if (i < matches.length) {
      out.push(
        <mark key={i} className="rounded px-1 py-0.5 bg-amber-100 text-amber-900">
          {matches[i]}
        </mark>
      );
    }
  }
  return <>{out}</>;
}

export default function SearchClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { side } = useSide();
  const theme = SIDE_THEMES[side];


  useReturnScrollRestore();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const initialQ = useMemo(() => String(sp?.get("q") || ""), [sp]);
  const initialTab = useMemo(() => safeTab(String(sp?.get("tab") || "all")), [sp]);
  const initialSet = useMemo(() => String(sp?.get("set") || ""), [sp]);
  const initialTopic = useMemo(() => String(sp?.get("topic") || ""), [sp]);

  const [q, setQ] = useState(initialQ);
  const [tab, setTab] = useState<TabId>(initialTab);

  const [filterSetId, setFilterSetId] = useState<string>(initialSet);
  const [filterSetLabel, setFilterSetLabel] = useState<string>("");

  const [filterTopic, setFilterTopic] = useState<string>(() => {
    const raw = String(initialTopic || "").trim().toLowerCase();
    const ids = new Set(PUBLIC_CHANNELS.map((c) => c.id));
    return ids.has(raw as any) ? raw : "";
  });


  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);

  const [sets, setSets] = useState<SetItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);

  // Keyboard navigation across visible result rows
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  const qn = useMemo(() => normQ(q).toLowerCase(), [q]);

  const backQS = useMemo(() => (sp ? sp.toString() : ""), [sp]);

  function updateUrl(nextQ: string, nextTab: TabId, nextSetId?: string, nextTopic?: string) {
    const params = new URLSearchParams(sp ? Array.from(sp.entries()) : []);
    if (nextQ) params.set("q", nextQ);
    else params.delete("q");

    if (nextTab && nextTab !== "all") params.set("tab", nextTab);
    else params.delete("tab");

    const sid = String(nextSetId || "").trim();
    if (sid) params.set("set", sid);
    else params.delete("set");

    
    const top = side === "public" ? String(nextTopic || "").trim() : "";
    if (top) params.set("topic", top);
    else params.delete("topic");
const qs = params.toString();
    router.replace(qs ? "/siddes-search?" + qs : "/siddes-search");
  }

  async function fetchAllSets(): Promise<{ items: SetItem[]; restricted: boolean }> {
    const res = await fetch("/api/sets?side=" + encodeURIComponent(side), { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as SetsResp;
    const isRestr = Boolean(data?.restricted);
    if (!res.ok) return { items: [], restricted: isRestr };

    const raw = Array.isArray(data.items) ? data.items : [];
    const mapped: SetItem[] = raw
      .map((it: any) => ({
        id: String(it?.id || ""),
        label: String(it?.label || ""),
        members: Array.isArray(it?.members) ? it.members.map((m: any) => String(m || "")).filter(Boolean) : [],
      }))
      .filter((s: any) => s.id && s.label);

    return { items: mapped, restricted: isRestr };
  }

  async function fetchSetsFiltered(useQ: string): Promise<{ items: SetItem[]; restricted: boolean }> {
    const out = await fetchAllSets();
    const useQL = String(useQ || "").toLowerCase();
    const filtered = out.items.filter((it) => it.label.toLowerCase().includes(useQL) || it.members.some((m) => String(m || "").toLowerCase().includes(useQL)));
    return { items: filtered, restricted: out.restricted };
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

  async function fetchPosts(useQ: string, useSetId?: string, useTopic?: string): Promise<{ items: PostItem[]; restricted: boolean }> {
    const params = new URLSearchParams();
    params.set("side", side);
    params.set("q", useQ);
    params.set("limit", "25");
    const sid = String(useSetId || "").trim();
    if (sid) params.set("set", sid);

    const res = await fetch("/api/search/posts?" + params.toString(), { cache: "no-store" });
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
      }))
      .filter((p) => p.id);

    return { items: mapped, restricted: isRestr };
  }

  async function resolveSetLabel(id: string) {
    const sid = String(id || "").trim();
    if (!sid) {
      setFilterSetLabel("");
      return;
    }
    try {
      const out = await fetchAllSets();
      const hit = out.items.find((x) => x.id === sid);
      if (hit) setFilterSetLabel(hit.label);
    } catch {}
  }

  async function runSearch(opts?: { q?: string; tab?: TabId; setId?: string; topic?: string }) {
    const useQ = normQ(typeof opts?.q === "string" ? opts.q : q);
    const useTab = typeof opts?.tab === "string" ? opts.tab : tab;
    const useSetId = typeof opts?.setId === "string" ? opts.setId : filterSetId;
    const useTopic = side === "public" ? String((opts as any)?.topic ?? filterTopic).trim() : "";

    setErr(null);
    updateUrl(useQ, useTab, useSetId, useTopic);

    if (!useQ || useQ.length < 2) {
      setRestricted(false);
      setSets([]);
      setUsers([]);
      setPosts([]);
      setActiveIdx(-1);
      return;
    }

    setLoading(true);
    try {
      const [setsOut, usersOut, postsOut] = await Promise.all([
        fetchSetsFiltered(useQ),
        fetchUsers(useQ),
        fetchPosts(useQ, useSetId, useTopic),
      ]);

      const anyRestr = Boolean(setsOut.restricted) || Boolean(usersOut.restricted) || Boolean(postsOut.restricted);
      setRestricted(anyRestr);

      setSets(setsOut.items || []);
      setUsers(usersOut.items || []);
      setPosts(postsOut.items || []);

      // reset selection whenever results change
      setActiveIdx(-1);

      if (useSetId && !filterSetLabel) void resolveSetLabel(useSetId);
    } catch {
      setErr("Search failed (network).");
      setRestricted(false);
      setSets([]);
      setUsers([]);
      setPosts([]);
      setActiveIdx(-1);
    } finally {
      setLoading(false);
    }
  }

  // Clear set filter when Side changes (set ids are side-scoped)
  useEffect(() => {
    let did = false;
    if (filterSetId) {
      setFilterSetId("");
      setFilterSetLabel("");
      did = true;
    }
    if (side !== "public" && filterTopic) {
      setFilterTopic("");
      did = true;
    }
    if (did) {
      updateUrl(normQ(q), tab, "", "");
    }
    setActiveIdx(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  useEffect(() => {
    const qq = normQ(initialQ);
    const st = initialSet;
    if (st) void resolveSetLabel(st);
    if (qq) void runSearch({ q: qq, tab: initialTab, setId: st, topic: initialTopic });
    // focus input
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cmd/Ctrl+K focuses input when already on search page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = String((e as any).key || "").toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tabs = useMemo(() => {
    const postsLabel = side === "public" ? "Takes" : "Notes";
    return [
      { id: "all" as const, label: "All", count: sets.length + users.length + posts.length, icon: SearchIcon },
      { id: "people" as const, label: "People", count: users.length, icon: UsersIcon },
      { id: "sets" as const, label: "Sets", count: sets.length, icon: LayersIcon },
      { id: "posts" as const, label: postsLabel, count: posts.length, icon: FileText },
    ];
  }, [sets.length, users.length, posts.length, side]);

  const showPeople = tab === "all" || tab === "people";
  const showSets = tab === "all" || tab === "sets";
  const showPosts = tab === "all" || tab === "posts";

  // Flatten visible results for ↑↓ navigation
  const navItems: NavItem[] = useMemo(() => {
    const out: NavItem[] = [];
    if (restricted || loading || qn.length < 2) return out;

    if (showPeople) {
      for (const u of users.slice(0, 25)) {
        out.push({
          key: "u:" + String(u.id),
          kind: "people",
          href: "/u/" + u.username,
          primary: u.handle || ("@" + u.username),
          secondary: u.isStaff ? "Staff" : "User",
        });
      }
    }
    if (showSets) {
      for (const it of sets.slice(0, 25)) {
        out.push({
          key: "s:" + String(it.id),
          kind: "sets",
          href: "/siddes-sets/" + it.id,
          primary: it.label,
          secondary: it.members.slice(0, 6).join(", "),
        });
      }
    }
    if (showPosts) {
      for (const p of posts.slice(0, 25)) {
        out.push({
          key: "p:" + String(p.id),
          kind: "posts",
          href: "/siddes-post/" + p.id,
          primary: (p.handle || p.author || "Post") + (p.time ? " • " + p.time : ""),
          secondary: p.content || "",
        });
      }
    }
    return out;
  }, [restricted, loading, qn.length, showPeople, showSets, showPosts, users, sets, posts]);

  // Keep selection in range
  useEffect(() => {
    if (activeIdx >= navItems.length) setActiveIdx(-1);
  }, [activeIdx, navItems.length]);

  // Scroll active row into view
  useEffect(() => {
    if (activeIdx < 0) return;
    const el = document.querySelector(`[data-result-idx="${activeIdx}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  function clearQuery() {
    setQ("");
    setTab("all");
    setFilterSetId("");
    setFilterSetLabel("");
    setErr(null);
    setRestricted(false);
    setSets([]);
    setUsers([]);
    setPosts([]);
    setActiveIdx(-1);
    updateUrl("", "all", "", "");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const k = String(e.key || "");
    if (k === "Escape") {
      e.preventDefault();
      if (activeIdx >= 0) {
        setActiveIdx(-1);
      } else if (qn) {
        clearQuery();
      }
      return;
    }

    if (k === "ArrowDown") {
      if (navItems.length) {
        e.preventDefault();
        setActiveIdx((prev) => {
          const next = prev < 0 ? 0 : Math.min(prev + 1, navItems.length - 1);
          return next;
        });
      }
      return;
    }

    if (k === "ArrowUp") {
      if (navItems.length) {
        e.preventDefault();
        setActiveIdx((prev) => {
          const next = prev < 0 ? navItems.length - 1 : Math.max(prev - 1, 0);
          return next;
        });
      }
      return;
    }

    if (k === "Enter") {
      if (activeIdx >= 0 && navItems[activeIdx]) {
        e.preventDefault();
        router.push(navItems[activeIdx].href);
        return;
      }
      void runSearch();
      return;
    }
  }

  const hint = useMemo(() => {
    if (!qn) return "Tip: Ctrl/Cmd+K focuses, Esc clears.";
    if (qn.length < 2) return "Type at least 2 characters.";
    return "↑↓ navigate • Enter open • Esc clear";
  }, [qn]);

  return (
    <div className="min-h-[70vh] px-4 py-8 flex justify-center">
      <div className="w-full max-w-[760px]">
        <div className="text-xs font-semibold text-gray-400">
          Search in <span className={theme.text + " font-bold"}>{SIDES[side].label}</span>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          {side === "public" ? null : <Lock size={14} className="text-gray-400" aria-hidden />}
          <span>
            Results are locked to <span className={theme.text + " font-bold"}>{SIDES[side].label}</span>.
          </span>
          <span className="text-gray-300">•</span>
          <Link href="/siddes-feed" className="text-xs font-bold text-gray-600 hover:text-gray-900">
            Now
          </Link>
        </div>

        <div className="mt-3 p-3 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-gray-100 border border-gray-200">
              <SearchIcon size={16} className="text-gray-700" />
            </div>

            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={side === "public" ? "Search people, sets, or takes…" : "Search people, sets, or notes…"}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-300"
              autoFocus
            />

            {qn ? (
              <button
                type="button"
                onClick={clearQuery}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Clear"
                aria-label="Clear"
              >
                <X size={18} className="text-gray-500" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={!qn || loading}
              className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {filterSetId ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-xs font-extrabold text-gray-700">
                <LayersIcon size={14} className="text-gray-500" />
                Set: {filterSetLabel || filterSetId}
                <button
                  type="button"
                  className="p-1 rounded-full hover:bg-white border border-transparent hover:border-gray-200"
                  aria-label="Clear set filter"
                  title="Clear set"
                  onClick={() => {
                    setFilterSetId("");
                    setFilterSetLabel("");
                    void runSearch({ setId: "" });
                  }}
                >
                  <X size={14} className="text-gray-500" />
                </button>
              </div>
              <div className="text-xs text-gray-400">Filtering post results to this set.</div>
            </div>
          ) : null}

          {err ? <div className="text-sm text-rose-600 mt-3">{err}</div> : null}

          <div className="mt-3 text-xs text-gray-500">{hint}</div>


          {!qn ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl border border-gray-200 bg-gray-50">
                <div className="text-xs font-extrabold text-gray-700">Handles</div>
                <div className="text-xs text-gray-500 mt-1">
                  Try <span className="font-mono">@ali</span>
                </div>
              </div>
              <div className="p-3 rounded-2xl border border-gray-200 bg-gray-50">
                <div className="text-xs font-extrabold text-gray-700">Set names</div>
                <div className="text-xs text-gray-500 mt-1">
                  Try <span className="font-mono">Gym Buddies</span>
                </div>
              </div>
              <div className="p-3 rounded-2xl border border-gray-200 bg-gray-50">
                <div className="text-xs font-extrabold text-gray-700">Keywords</div>
                <div className="text-xs text-gray-500 mt-1">
                  Try <span className="font-mono">meeting</span> or <span className="font-mono">lasagna</span>
                </div>
              </div>
            </div>
          ) : null}


          {qn && qn.length >= 2 ? (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTab(t.id);
                      setActiveIdx(-1);
                      updateUrl(qn, t.id, filterSetId, filterTopic);
                    }}
                    className={
                      "px-4 py-2 rounded-full border text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all " +
                      (active ? "bg-gray-900 text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")
                    }
                  >
                    <Icon size={14} />
                    {t.label}
                    <span className={"ml-1 " + (active ? "text-white/80" : "text-gray-400")}>{t.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {qn && qn.length >= 2 ? (
          <div className="mt-6">
            {restricted ? (
              <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50">
                <div className="text-base font-extrabold text-amber-900">Search is restricted</div>
                <div className="text-sm text-amber-900/70 mt-1">Sign in (or enable dev viewer) to search.</div>
              </div>
            ) : null}

            {!restricted && !loading && sets.length + users.length + posts.length === 0 ? (
              <div className="p-6 rounded-2xl border border-gray-200 bg-white text-center">
                <div className="text-lg font-extrabold text-gray-900">No results</div>
                <div className="text-sm text-gray-500 mt-1">Try a different keyword.</div>
              </div>
            ) : null}

            {!restricted ? (
              <div className="space-y-6">
                {showPeople && users.length ? (
                  <div className="p-4 rounded-2xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-extrabold text-gray-700">People</div>
                      <div className="text-xs font-bold text-gray-500">{users.length}</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {users.slice(0, 25).map((u) => {
                        const idx = navItems.findIndex((x) => x.key === "u:" + String(u.id));
                        const active = idx >= 0 && idx === activeIdx;
                        return (
                          <Link
                            key={u.id}
                            data-result-idx={idx >= 0 ? idx : undefined}
                            href={"/u/" + u.username}
                            onClick={() => { try { saveReturnScroll(); } catch {} }}
                            className={
                              "block p-3 rounded-xl border transition-all outline-none " +
                              (active
                                ? "bg-white border-gray-300 ring-2 ring-gray-900/10"
                                : "border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200")
                            }
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-gray-900 truncate">{highlight(u.handle, qn)}</div>
                                <div className="text-xs text-gray-500 truncate">{u.isStaff ? "Staff" : "User"}</div>
                              </div>
                              <div className="text-xs font-extrabold text-gray-600">Open</div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {showSets && sets.length ? (
                  <div className="p-4 rounded-2xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-extrabold text-gray-700">Sets</div>
                      <div className="text-xs font-bold text-gray-500">{sets.length}</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {sets.slice(0, 25).map((it) => {
                        const idx = navItems.findIndex((x) => x.key === "s:" + String(it.id));
                        const active = idx >= 0 && idx === activeIdx;
                        return (
                          <div
                            key={it.id}
                            data-result-idx={idx >= 0 ? idx : undefined}
                            className={
                              "p-3 rounded-xl border flex items-center justify-between gap-3 transition-all " +
                              (active
                                ? "bg-white border-gray-300 ring-2 ring-gray-900/10"
                                : "border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200")
                            }
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-gray-900 truncate">{highlight(it.label, qn)}</div>
                              <div className="text-xs text-gray-500 truncate">
                                Members: {it.members.slice(0, 6).join(", ")}
                                {it.members.length > 6 ? " +" + String(it.members.length - 6) + " more" : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setFilterSetId(it.id);
                                  setFilterSetLabel(it.label);
                                  setTab("posts");
                                  setActiveIdx(-1);
                                  void runSearch({ tab: "posts", setId: it.id });
                                }}
                                className="px-3 py-2 rounded-full bg-white border border-gray-200 text-xs font-extrabold text-gray-700 hover:bg-gray-100"
                                title="Filter post results to this set"
                              >
                                Filter
                              </button>
                              <Link
                                href={"/siddes-sets/" + it.id}
                                className="px-3 py-2 rounded-full bg-white border border-gray-200 text-xs font-extrabold text-gray-700 hover:bg-gray-100"
                              >
                                Open
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {showPosts && posts.length ? (
                  <div className="p-4 rounded-2xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-extrabold text-gray-700">{side === "public" ? "Takes" : "Notes"}</div>
                      <div className="text-xs font-bold text-gray-500">{posts.length}</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {posts.slice(0, 25).map((p) => {
                        const idx = navItems.findIndex((x) => x.key === "p:" + String(p.id));
                        const active = idx >= 0 && idx === activeIdx;
                        return (
                          <Link
                            key={p.id}
                            data-result-idx={idx >= 0 ? idx : undefined}
                             data-post-id={String(p.id)}
                            href={"/siddes-post/" + p.id + "?from=search" + (backQS ? "&back=" + encodeURIComponent(backQS) : "")}
                            onClick={() => { try { saveReturnScroll(String(p.id)); } catch {} }}
                            className={
                              "block p-3 rounded-xl border transition-all outline-none " +
                              (active
                                ? "bg-white border-gray-300 ring-2 ring-gray-900/10"
                                : "border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200")
                            }
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-gray-900 truncate">
                                  {highlight(p.handle || p.author || "Post", qn)} {p.time ? "• " + p.time : ""}
                                </div>
                                <div className="text-xs text-gray-500 truncate">{highlight(p.content || "", qn)}</div>
                              </div>
                              <div className="text-xs font-extrabold text-gray-600 whitespace-nowrap">Open</div>
                            </div>
                          </Link>
                        );
                      })}
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
