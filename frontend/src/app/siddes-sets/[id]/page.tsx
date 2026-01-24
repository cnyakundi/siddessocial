"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSide } from "@/src/components/SideProvider";
import { useEffect, useMemo, useState, useCallback } from "react";
import { ArrowLeft, History, Mail, Plus, RefreshCcw, Settings, Shield, Trash2, UserMinus, LogOut } from "lucide-react";

import { getSetsProvider } from "@/src/lib/setsProvider";
import type { SetDef } from "@/src/lib/sets";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import { getSetTheme } from "@/src/lib/setThemes";
import type { SetEvent } from "@/src/lib/setEvents";

import { getFeedProvider } from "@/src/lib/feedProvider";
import type { FeedItem } from "@/src/lib/feedProvider";
import { PostCard } from "@/src/components/PostCard";

import type { SetInvite } from "@/src/lib/inviteProvider";
import { getInviteProvider } from "@/src/lib/inviteProvider";
import { InviteActionSheet } from "@/src/components/Invites/InviteActionSheet";
import { InviteList } from "@/src/components/Invites/InviteList";

import { fetchInviteSuggestionHandles } from "@/src/lib/inviteSuggestions";
import { emitSetsChanged, onSetsChanged } from "@/src/lib/setsSignals";
import { toast } from "@/src/lib/toast";
import { useReturnScrollRestore } from "@/src/hooks/returnScroll";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const COLOR_OPTIONS: SetColor[] = ["orange", "purple", "blue", "emerald", "rose", "slate"];

function normalizeHandle(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (t.startsWith("@")) return t;
  return `@${t.replace(/^@+/, "")}`;
}

function fmt(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function kindLabel(k: SetEvent["kind"]) {
  switch (k) {
    case "created":
      return "Created";
    case "renamed":
      return "Renamed";
    case "members_updated":
      return "Members updated";
    case "moved_side":
      return "Moved Side";
    case "recolored":
      return "Recolored";
    default:
      return k;
  }
}

function kindDetail(e: SetEvent): string {
  const d: any = e.data || {};
  if (e.kind === "renamed") return `${d.from ?? "?"} → ${d.to ?? "?"}`;
  if (e.kind === "members_updated") {
    const from = Array.isArray(d.from) ? d.from.length : "?";
    const to = Array.isArray(d.to) ? d.to.length : "?";
    const via = typeof d.via === "string" ? ` (${d.via})` : "";
    return `${from} → ${to}${via}`;
  }
  if (e.kind === "moved_side") return `${d.from ?? "?"} → ${d.to ?? "?"}`;
  if (e.kind === "recolored") return `${d.from ?? "?"} → ${d.to ?? "?"}`;
  return "";
}

type TabId = "feed" | "people" | "invites" | "settings" | "history";

function TabButton({
  id,
  label,
  active,
  onClick,
}: {
  id: TabId;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all",
        active ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </button>
  );
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function SiddesSetHubPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { setSide: setAppSide, setSideLock, clearSideLock } = useSide();

  useEffect(() => {
    return () => {
      clearSideLock();
    };
  }, [clearSideLock]);

  // sd_464c: restore scroll when returning from post detail
  useReturnScrollRestore();
  const setId = decodeURIComponent(params.id || "");

  const setsProvider = useMemo(() => getSetsProvider(), []);
  const invitesProvider = useMemo(() => getInviteProvider(), []);
  const feedProvider = useMemo(() => getFeedProvider(), []);

  const [tab, setTab] = useState<TabId>("feed");
  const [item, setItem] = useState<SetDef | null>(null);
  const [events, setEvents] = useState<SetEvent[]>([]);
  const [outInvites, setOutInvites] = useState<SetInvite[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isOwner = Boolean((item as any)?.isOwner === true);
  const canWrite = isOwner;

  // Settings fields (owner)
  const [label, setLabel] = useState("");
  const [side, setSide] = useState<SideId>("friends");
  const [color, setColor] = useState<SetColor>("emerald");

  // Feed paging
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedErr, setFeedErr] = useState<string | null>(null);

  // Invites sheet
  const [inviteOpen, setInviteOpen] = useState(false);
  const [prefillTo, setPrefillTo] = useState<string | null>(null);
  const [inviteChips, setInviteChips] = useState<string[]>([]);
  const [inviteChipsLoading, setInviteChipsLoading] = useState(false);

  const themeSide = item ? SIDE_THEMES[item.side] : SIDE_THEMES[side];
  const themeSet = item ? getSetTheme(item.color) : getSetTheme(color);

  const composeHref = item ? `/siddes-compose?side=${encodeURIComponent(item.side)}&set=${encodeURIComponent(item.id)}` : `/siddes-compose`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const got = await setsProvider.get(setId);
      setItem(got);

      if (got) {
        setLabel(got.label);
        setSide(got.side);
        try {
          setSideLock({ side: got.side, reason: "set" });
          setAppSide(got.side);
        } catch {}
        setColor(got.color);

        const evts = await setsProvider.events(setId);
        setEvents(evts);

        // Outgoing invites for this Set (best-effort).
        try {
          const inv = await invitesProvider.list({ direction: "outgoing" });
          setOutInvites(inv.filter((x) => x.setId === setId));
        } catch {
          setOutInvites([]);
        }
      } else {
        setEvents([]);
        setOutInvites([]);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load Set.");
      setItem(null);
      setEvents([]);
      setOutInvites([]);
    } finally {
      setLoading(false);
    }
  }, [invitesProvider, setId, setsProvider, setAppSide, setSideLock]);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Cross-tab/accept-invite refresh
  useEffect(() => {
    return onSetsChanged(() => {
      void refresh();
    });
  }, [refresh]);

  // Invite suggestion chips (owner-only)
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!item || !isOwner) {
        if (alive) setInviteChips([]);
        return;
      }

      try {
        setInviteChipsLoading(true);
        const pool = await fetchInviteSuggestionHandles(item.side, item.members || []);
        const cur = new Set((item.members || []).map((x) => String(x || "").trim()));
        const filtered = pool.filter((h) => !cur.has(h));
        if (alive) setInviteChips(filtered);
      } catch {
        if (alive) setInviteChips([]);
      } finally {
        if (alive) setInviteChipsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [item, isOwner]);

  // Feed: load first page when entering Feed tab or set changes
  const loadFeedFirst = useCallback(async () => {
    if (!item) return;
    setFeedLoading(true);
    setFeedErr(null);
    try {
      const page = await feedProvider.listPage(item.side, { set: item.id, limit: 30, cursor: null });
      setPosts(page.items || []);
      setNextCursor(page.nextCursor);
      setHasMore(Boolean(page.hasMore));
    } catch (e: any) {
      setFeedErr(e?.message || "Failed to load feed.");
      setPosts([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setFeedLoading(false);
    }
  }, [feedProvider, item]);

  const loadFeedMore = useCallback(async () => {
    if (!item) return;
    if (!hasMore || !nextCursor) return;
    if (feedLoading) return;

    setFeedLoading(true);
    setFeedErr(null);
    try {
      const page = await feedProvider.listPage(item.side, { set: item.id, limit: 30, cursor: nextCursor });
      const nextItems = page.items || [];
      setPosts((prev) => {
        const seen = new Set(prev.map((p: any) => (p as any)?.id));
        const out = [...prev];
        for (const it of nextItems) {
          const id = (it as any)?.id;
          if (id && !seen.has(id)) {
            seen.add(id);
            out.push(it);
          }
        }
        return out;
      });
      setNextCursor(page.nextCursor);
      setHasMore(Boolean(page.hasMore));
    } catch (e: any) {
      setFeedErr(e?.message || "Failed to load more.");
    } finally {
      setFeedLoading(false);
    }
  }, [feedLoading, feedProvider, hasMore, item, nextCursor]);

  useEffect(() => {
    if (tab !== "feed") return;
    if (!item) return;
    void loadFeedFirst();
  }, [tab, item, loadFeedFirst]);

  const saveSettings = async () => {
    if (!item) return;
    if (!canWrite) {
      toast.error("Only the Set owner can change settings.");
      return;
    }

    try {
      const patch: any = {
        label: (label || "").trim() || item.label,
        side,
        color,
        members: item.members || [],
      };

      const updated = await setsProvider.update(item.id, patch);
      if (!updated) {
        toast.error("Set not found.");
        return;
      }

      setItem(updated);
      setLabel(updated.label);
      setSide(updated.side);
      setColor(updated.color);

      const evts = await setsProvider.events(updated.id);
      setEvents(evts);

      toast.success("Saved.");
    } catch (e: any) {
      toast.error(e?.message || "Save failed.");
    }
  };

  const removeMember = async (h: string) => {
    if (!item) return;
    if (!canWrite) return;

    const target = normalizeHandle(h);
    if (!target) return;

    const ok = window.confirm(`Remove ${target} from ${item.label}?`);
    if (!ok) return;

    try {
      const next = (item.members || []).filter((m) => String(m || "").trim() !== target);
      const updated = await setsProvider.update(item.id, { members: next });
      if (!updated) {
        toast.error("Set not found.");
        return;
      }
      setItem(updated);
      emitSetsChanged();
      toast.success("Member removed.");

      const evts = await setsProvider.events(updated.id);
      setEvents(evts);
    } catch (e: any) {
      toast.error(e?.message || "Remove failed.");
    }
  };

  const leaveSet = async () => {
    if (!item) return;
    if (isOwner) {
      toast.error("Owners can't leave their own Set. Delete it instead.");
      return;
    }

    const ok = window.confirm(`Leave ${item.label}?`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/sets/${encodeURIComponent(item.id)}/leave`, { method: "POST" });
      const data = await safeJson(res);
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : `leave failed (${res.status})`;
        toast.error(msg);
        return;
      }

      emitSetsChanged();
      toast.success("Left Set.");
      router.push("/siddes-sets");
    } catch (e: any) {
      toast.error(e?.message || "Leave failed.");
    }
  };

  const deleteSet = async () => {
    if (!item) return;
    if (!isOwner) {
      toast.error("Only the Set owner can delete.");
      return;
    }

    const ok = window.confirm(`Delete ${item.label}? This cannot be undone.`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/sets/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const data = await safeJson(res);
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : `delete failed (${res.status})`;
        toast.error(msg);
        return;
      }

      emitSetsChanged();
      toast.success("Deleted.");
      router.push("/siddes-sets");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed.");
    }
  }

  const revokeInvite = async (inviteId: string) => {
    if (!item) return;
    if (!isOwner) {
      toast.error("Only the Set owner can revoke invites.");
      return;
    }

    const ok = window.confirm("Revoke this invite? The recipient will no longer be able to accept it.");
    if (!ok) return;

    try {
      const updated = await invitesProvider.act(inviteId, "revoke");
      if (!updated) {
        toast.error("Invite not found.");
        return;
      }

      setOutInvites((prev) => prev.map((x) => (x.id === inviteId ? updated : x)));
      toast.success("Invite revoked.");
    } catch (e: any) {
      toast.error(e?.message || "Revoke failed.");
    }
  };
;

  const membersCount = item ? (item.members || []).length : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/siddes-sets"
              className="px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Sets
            </Link>

            <div className="min-w-0">
              <div className="text-lg font-extrabold text-gray-900 truncate">{item ? item.label : "Set"}</div>
              <div className="text-[11px] text-gray-400 font-mono truncate">{setId}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 flex items-center gap-2"
              aria-label="Refresh"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>

            <Link
              href={composeHref}
              className={cn(
                "px-3 py-2 rounded-full border font-bold text-sm flex items-center gap-2",
                item ? cn(themeSide.primaryBg, "text-white border-transparent hover:opacity-95") : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              )}
              aria-disabled={!item}
              tabIndex={!item ? -1 : 0}
            >
              <Plus size={16} />
              New Post
            </Link>
          </div>
        </div>

        {err ? (
          <div className="mb-3 p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
            <div className="font-bold">Error</div>
            <div className="text-xs mt-1">{err}</div>
          </div>
        ) : null}

        {/* Context stamp (Side + Set) */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 mb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-black uppercase tracking-widest", themeSide.lightBg, themeSide.text, themeSide.border)}>
                  {SIDES[item ? item.side : side].label}
                </span>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-black uppercase tracking-widest", themeSet.bg, themeSet.text, themeSet.border)}>
                  {item ? item.color : color}
                </span>
                {loading ? <span className="text-xs text-gray-400 font-bold">Loading…</span> : null}
              </div>
              <div className="text-xs text-gray-500">
                {item ? (
                  item.side === "public" ? (
                    <>Public Set • Anyone can view</>
                  ) : (
                    <>Audience locked • Only members can view</>
                  )
                ) : (
                  <> </>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-gray-500 font-bold">{membersCount} members</div>
              <div className="text-[11px] text-gray-400 font-mono">{isOwner ? "owner" : "member"}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-0 z-30 bg-gray-50">
          <div className="px-1">
            <div className="p-3 rounded-2xl bg-white border border-gray-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-6">
                  <TabButton id="feed" label="Feed" active={tab === "feed"} onClick={() => setTab("feed")} />
                  <TabButton id="people" label="People" active={tab === "people"} onClick={() => setTab("people")} />
                  {isOwner ? (
                    <>
                      <TabButton id="invites" label="Invites" active={tab === "invites"} onClick={() => setTab("invites")} />
                      <TabButton id="settings" label="Settings" active={tab === "settings"} onClick={() => setTab("settings")} />
                    </>
                  ) : null}
                  <TabButton id="history" label="History" active={tab === "history"} onClick={() => setTab("history")} />
                </div>

                {/* mini anchor */}
                <div className="px-2 py-1 rounded-full bg-gray-50 border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-600 max-w-[160px] truncate">
                  {item ? item.label : "Set"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab body */}
        <div className="mt-3">
          {/* FEED */}
          {tab === "feed" ? (
            <div className="space-y-3">
              {/* sd_466c: Set hub "Write" row (dead simple, set-specific) */}
              <div className="p-4 rounded-2xl bg-white border border-gray-200">
                <button
                  type="button"
                  onMouseEnter={() => {
                    try {
                      router.prefetch(composeHref);
                    } catch {}
                  }}
                  onTouchStart={() => {
                    try {
                      router.prefetch(composeHref);
                    } catch {}
                  }}
                  onClick={() => router.push(composeHref)}
                  className="w-full flex items-center gap-4 p-3 bg-gray-50 border border-gray-100 rounded-2xl text-left active:bg-gray-100 transition-colors"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full border flex items-center justify-center text-[11px] font-black shrink-0",
                      themeSide.lightBg,
                      themeSide.text,
                      themeSide.border
                    )}
                    aria-hidden="true"
                  >
                    ME
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 font-medium truncate">{item ? ("Post to " + item.label + "…") : "Write…"}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 truncate">
                      {SIDES[item ? item.side : side].label}{item ? (" • " + item.label) : ""}</div>
                  </div>

                  <div className={cn("px-4 py-2 rounded-xl text-xs font-black text-white shadow-sm", themeSide.primaryBg)}>
                    Write
                  </div>
                </button>
              </div>

{feedErr ? (
                <div className="p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
                  <div className="font-bold">Error</div>
                  <div className="text-xs mt-1">{feedErr}</div>
                </div>
              ) : null}

              {feedLoading && !posts.length ? (
                <div className="p-6 rounded-2xl bg-white border border-gray-200 text-sm text-gray-600">Loading…</div>
              ) : null}

              {!feedLoading && !posts.length && item ? (
                <div className="p-8 rounded-2xl bg-white border border-dashed border-gray-200 text-center">
                  <div className="font-black text-gray-900 mb-1">No posts yet</div>
                  <div className="text-sm text-gray-500 mb-4">Start the first post in this Set.</div>
                  <Link
                    href={composeHref}
                    className={cn("inline-flex px-4 py-2 rounded-full text-sm font-extrabold text-white shadow-sm hover:opacity-95 transition", themeSide.primaryBg)}
                  >
                    New Post
                  </Link>
                </div>
              ) : null}

              <div className="space-y-3">
                {posts.map((p: any) => (
                  <PostCard key={(p as any).id} post={p as any}  side={item ? item.side : side} />
                ))}
              </div>

              {hasMore ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => void loadFeedMore()}
                    disabled={feedLoading}
                    className={cn(
                      "w-full py-2.5 rounded-xl font-bold text-sm border flex items-center justify-center gap-2",
                      feedLoading
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    {feedLoading ? "Loading…" : "Load more"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* PEOPLE */}
          {tab === "people" ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white border border-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-gray-900">People</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-start gap-2">
                      <Shield size={14} className="text-gray-300 mt-0.5" />
                      <span>
                        {item?.side === "public"
                          ? "Public Set: anyone can view posts."
                          : `This Set lives in ${SIDES[item ? item.side : side].label}. Only Set members can see posts here. Other Sides can't see this Set.`}
                      </span>
                    </div>
                    {!isOwner ? <div className="text-[11px] text-gray-400 mt-2">Only the owner can invite people.</div> : null}
                  </div>

                  {!isOwner && item ? (
                    <button
                      type="button"
                      onClick={() => void leaveSet()}
                      className="px-3 py-2 rounded-full bg-white border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut size={16} />
                      Leave
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-500">Members</div>
                  <div className="text-xs text-gray-500 font-bold">{membersCount}</div>
                </div>

                {item?.members?.length ? (
                  <div className="divide-y divide-gray-100">
                    {item.members.map((m) => (
                      <div key={m} className="py-3 flex items-center justify-between gap-3">
                        {/* sd_480_members_link: make member handles open profiles */}
                        <Link
                          href={`/u/${encodeURIComponent(String(m || "").replace(/^@/, ""))}`}
                          className="min-w-0 block"
                          title="View profile"
                        >
                          <div className="font-bold text-gray-900 hover:underline">{m}</div>
                          <div className="text-[11px] text-gray-400 font-mono truncate">member</div>
                        </Link>

                        {isOwner ? (
                          <button
                            type="button"
                            onClick={() => void removeMember(m)}
                            className="p-2 rounded-full border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                            aria-label={`Remove ${m}`}
                          >
                            <UserMinus size={16} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed border-gray-200 text-center">
                    <div className="font-black text-gray-900 mb-1">No members listed</div>
                    <div className="text-sm text-gray-500">Invite people to build this Set.</div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* INVITES (owner-only tab) */}
          {tab === "invites" ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white border border-gray-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-gray-900 flex items-center gap-2">
                      <Mail size={18} />
                      Invites
                    </div>
                    <div className="text-xs text-gray-500">Invite more people to this Set</div>
                  </div>
                  <button
                    type="button"
                    disabled={!item || !isOwner}
                    onClick={() => {
                      setPrefillTo(null);
                      setInviteOpen(true);
                    }}
                    className={cn(
                      "px-3 py-2 rounded-full border font-bold text-sm",
                      !item || !isOwner
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    Invite
                  </button>
                </div>

                {inviteChipsLoading ? <div className="text-[11px] text-gray-400 mt-3">Loading suggestions…</div> : null}
                {inviteChips.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inviteChips.slice(0, 8).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          setPrefillTo(h);
                          setInviteOpen(true);
                        }}
                        className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-black hover:bg-gray-200"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="p-4 rounded-2xl bg-white border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="font-black text-gray-900">Outgoing invites</div>
                  <div className="text-xs text-gray-500 font-bold">{outInvites.length}</div>
                </div>

                <InviteList items={outInvites} canRevoke={isOwner} onRevoke={(inv) => void revokeInvite(inv.id)} />

                {!outInvites.length ? (
                  <div className="p-6 rounded-2xl border border-dashed border-gray-200 text-center mt-3">
                    <div className="font-black text-gray-900 mb-1">No invites yet</div>
                    <div className="text-sm text-gray-500">Create an invite to bring people in.</div>
                  </div>
                ) : null}
              </div>

              <InviteActionSheet
                open={inviteOpen}
                onClose={() => {
                  setInviteOpen(false);
                  setPrefillTo(null);
                }}
                setId={setId}
                side={item ? item.side : side}
                prefillTo={prefillTo || undefined}
                onCreated={(inv) => {
                  setOutInvites((prev) => [inv, ...prev.filter((x) => x.id !== inv.id)].filter((x) => x.setId === setId));
                }}
              />
            </div>
          ) : null}

          {/* SETTINGS (owner-only tab) */}
          {tab === "settings" ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="font-black text-gray-900 flex items-center gap-2">
                    <Settings size={18} />
                    Settings
                  </div>
                  <button
                    type="button"
                    disabled={!item || !isOwner}
                    onClick={() => void saveSettings()}
                    className={cn(
                      "px-3 py-2 rounded-full border font-bold text-sm",
                      !item || !isOwner
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-gray-900 text-white border-gray-900 hover:opacity-95"
                    )}
                  >
                    Save
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <div className="text-xs font-bold text-gray-700 mb-1">Label</div>
                    <input
                      value={label}
                      readOnly={!isOwner}
                      onChange={(e) => setLabel(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10",
                        !isOwner && "bg-gray-50 text-gray-600"
                      )}
                      placeholder="Set name"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-gray-700 mb-1">Side</div>
                    <select
                      value={side}
                      disabled={!isOwner}
                      onChange={(e) => setSide(e.target.value as SideId)}
                      className={cn(
                        "w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10",
                        !isOwner && "bg-gray-50 text-gray-600 cursor-not-allowed"
                      )}
                    >
                      {Object.values(SIDES).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-gray-700 mb-1">Color</div>
                    <select
                      value={color}
                      disabled={!isOwner}
                      onChange={(e) => setColor(e.target.value as SetColor)}
                      className={cn(
                        "w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 ring-gray-900/10",
                        !isOwner && "bg-gray-50 text-gray-600 cursor-not-allowed"
                      )}
                    >
                      {COLOR_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-gray-400 mt-1">Blue is reserved for Public.</div>
                  </div>
                </div>

                {!isOwner ? <div className="mt-3 text-xs text-gray-500">Read-only: only the Set owner can change settings.</div> : null}
              </div>

              <div className="p-4 rounded-2xl bg-white border border-red-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-red-700 flex items-center gap-2">
                      <Trash2 size={18} />
                      Danger Zone
                    </div>
                    <div className="text-xs text-red-700/70">Delete is permanent.</div>
                  </div>

                  <button
                    type="button"
                    disabled={!isOwner || !item}
                    onClick={() => void deleteSet()}
                    className={cn(
                      "px-3 py-2 rounded-full border font-bold text-sm",
                      !isOwner || !item
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-red-600 text-white border-red-600 hover:bg-red-700"
                    )}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* HISTORY */}
          {tab === "history" ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white border border-gray-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-gray-900 flex items-center gap-2">
                      <History size={18} />
                      History
                    </div>
                    <div className="text-xs text-gray-500">Server-truth event log for this Set</div>
                  </div>
                  <div className="text-xs text-gray-500 font-bold whitespace-nowrap">{events.length} events</div>
                </div>
              </div>

              <div className="space-y-2">
                {events.map((e) => (
                  <div key={e.id} className="p-3 rounded-2xl border border-gray-200 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-gray-900 text-sm">{kindLabel(e.kind)}</div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{kindDetail(e)}</div>
                      </div>
                      <div className="text-[11px] text-gray-400 text-right whitespace-nowrap">
                        <div className="font-semibold">{fmt(e.ts)}</div>
                        <div className="font-mono">{e.by}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {!events.length ? (
                  <div className="p-6 rounded-2xl border border-dashed border-gray-200 text-center">
                    <div className="font-black text-gray-900 mb-1">No events yet</div>
                    <div className="text-sm text-gray-500">
                      {isOwner ? "Create, invite, or edit the Set to generate history." : "History is generated when the owner updates this Set."}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
