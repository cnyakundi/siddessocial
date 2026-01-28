"use client";

/* eslint-disable react/jsx-no-comment-textnodes */
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

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

import { ProfileV2Header } from "@/src/components/ProfileV2Header";
import { ProfileV2Tabs, type ProfileV2TabId } from "@/src/components/ProfileV2Tabs";

import { PostCard } from "@/src/components/PostCard";

import { useReturnScrollRestore } from "@/src/hooks/returnScroll";

import { ProfileActionsSheet } from "@/src/components/ProfileActionsSheet";
import { AccessRequestsPanel } from "@/src/components/AccessRequestsPanel";
import { toast } from "@/src/lib/toast";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export default function UserProfilePage() {
  const params = useParams() as { username?: string };

  const router = useRouter();
  const raw = String(params?.username || "");

  useReturnScrollRestore();

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

  const [loadingMore, setLoadingMore] = useState(false);

  const [activeIdentitySide, setActiveIdentitySide] = useState<SideId>("public");

  const [sideSheet, setSideSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const [msgBusy, setMsgBusy] = useState(false);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [lockedSide, setLockedSide] = useState<SideId | null>(null);
  const [accessReqBusy, setAccessReqBusy] = useState(false);
  const [accessReqSentFor, setAccessReqSentFor] = useState<SideId | null>(null);

  const [contentTab, setContentTab] = useState<ProfileV2TabId>("posts");

  const searchParams = useSearchParams();

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "posts" || t === "media" || t === "sets") {
      setContentTab(t as ProfileV2TabId);
    }
  }, [searchParams]);

  const pickContentTab = (tab: ProfileV2TabId) => {
    setContentTab(tab);

    // Update URL without navigation
    try {
      const url = new URL(window.location.href);
      if (tab === "posts") url.searchParams.delete("tab");
      else url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    } catch {}

    // Nudge scroll so the tabs stay in view
    try {
      const el = document.getElementById("profile-v2-tabs");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  };

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

        if (j && typeof j === "object" && j.ok === false && j.error === "locked") {
          const fallback = (j.viewSide || "public") as SideId;
          const requested = (j.requestedSide || activeIdentitySide || "public") as SideId;
          if (fallback && fallback !== activeIdentitySide) {
            toast.info(`Locked: ${SIDES[requested]?.label || requested}. Showing ${SIDES[fallback]?.label || fallback}.`);
            setActiveIdentitySide(fallback);
            return;
          }
        }

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

  const postsPayload = data?.posts || null;
  const posts = postsPayload?.items || [];

  const postsCount = typeof postsPayload?.count === "number" ? postsPayload.count : posts.length;

  const avatarUrl = String((facet as any)?.avatarImage || "").trim() || null;

  useEffect(() => {
    setContentTab("posts");

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, [displaySide]);

  const doPickSide = async (side: SideId | "public", opts?: { silent?: boolean }) => {
    if (!user?.handle) return;

    const before = viewerSidedAs;

    setBusy(true);
    try {
      const postSide = async (wanted: SideId | "public") => {
        const res = await fetch("/api/side", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
          targetUserId: user?.id || null,
            username: user.handle,
            side: wanted,
            confirm: wanted === "close" || wanted === "work" ? true : undefined,
          }),
        });
        const j = (await res.json().catch(() => null)) as any;
        return { res, j };
      };

      let out = await postSide(side);
      let res = out.res;
      let j = out.j;

      if ((!res.ok || !j || j.ok !== true) && side === "close" && j?.error === "friends_required") {
        toast.info("Close is inside Friends — adding to Friends first…");
        try {
          await postSide("friends");
        } catch {
          // ignore
        }
        out = await postSide("close");
        res = out.res;
        j = out.j;
      }

      if (!res.ok || !j || j.ok !== true) {
        let msg = res.status === 429 ? "Slow down." : "Could not update Side.";
        if (j?.error === "confirm_required") msg = "Confirmation required for Close/Work.";
        if (res.status === 401 || j?.error === "restricted") msg = "Login required.";
        toast.error(msg);
        throw new Error(msg);
      }

      setData((prev) => {
        if (!prev || !prev.ok) return prev;
        return { ...prev, viewerSidedAs: j.side || null } as any;
      });

      if (!opts?.silent) {
        const nextSide = (j?.side || null) as SideId | null;
        const beforeKey = before || "public";
        const nextKey = (nextSide || "public") as any;
        if (String(beforeKey) !== String(nextKey)) {
          const nextLabel = nextSide ? (SIDES[nextSide]?.label || nextSide) : "Public";
          toast.undo(`You show them: ${nextLabel}`, () => {
            void doPickSide((before || "public") as any, { silent: true });
            toast.success("Undone");
          });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const doRequestAccess = async (side: SideId) => {
    if (!user?.handle) return;
    const s = String(side || "").toLowerCase() as SideId;
    if (s === "public") return;

    setAccessReqBusy(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserId: user?.id || null, username: user.handle, side: s }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok || !j || j.ok !== true) {
        let msg = res.status === 429 ? "Slow down." : "Could not send request.";
        if (res.status === 401 || j?.error === "restricted") msg = "Login required.";
        toast.error(msg);
        return;
      }
      setAccessReqSentFor(s);
      toast.success("Request sent.");
      setLockedSide(null);
    } catch {
      toast.error("Could not send request.");
    } finally {
      setAccessReqBusy(false);
    }
  };

  const doMessage = async () => {
    if (!user?.handle) return;
    if (msgBusy) return;

    setMsgBusy(true);
    try {
      // Default-safe: DM thread lives in the side you show them (falls back to Friends).
      const locked: SideId = viewerSidedAs && viewerSidedAs !== "public" ? viewerSidedAs : "friends";

      const displayName =
        (facet?.displayName || "").trim() || String(user.handle || "").replace(/^@/, "").trim() || "User";

      const res = await fetch("/api/inbox/threads", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserId: user?.id || null,
          targetHandle: user.handle,
          lockedSide: locked,
          displayName,
        }),
      });

      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok || !j) {
        const host = (() => {
          try {
            return String(window.location.hostname || "").toLowerCase();
          } catch {
            return "";
          }
        })();
        const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";

        // sd_756_inbox_store_unavailable_ui: backend/store failures should not masquerade as login.
        if (res.status >= 500) {
          toast.error(isLocal ? "Inbox backend unavailable (run migrations + restart backend)." : "Inbox temporarily unavailable.");
          return;
        }

        toast.error(res.status === 401 ? "Login required." : "Could not start message.");
        return;
      }

      // sd_756_inbox_store_unavailable_ui: explicit store failure payload (rare if server returns 200).
      if (j?.ok === false && j?.error === "store_unavailable") {
        toast.error("Inbox backend unavailable. Try again after backend is healthy.");
        return;
      }
      if (j?.restricted) {
        const host = (() => {
          try {
            return String(window.location.hostname || "").toLowerCase();
          } catch {
            return "";
          }
        })();
        const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
        toast.error(isLocal ? "Login required (local stub viewer not set). Refresh once." : "Login required.");
        if (!isLocal) {
          try {
            router.push("/login");
          } catch {}
        }
        return;
      }

const tid = String(j?.thread?.id || "").trim();
      if (!tid) {
        toast.error("Could not start message.");
        return;
      }

      router.push(`/siddes-inbox/${encodeURIComponent(tid)}`);
    } catch {
      toast.error("Could not start message.");
    } finally {
      setMsgBusy(false);
    }
  };

  const loadMore = async () => {
    if (!handle || loadingMore) return;
    const cur = String((postsPayload as any)?.nextCursor || "").trim();
    if (!cur) return;

    setLoadingMore(true);
    try {
      const qs = `?side=${encodeURIComponent(displaySide)}&cursor=${encodeURIComponent(cur)}`;
      const res = await fetch(`/api/profile/${encodeURIComponent(handle)}${qs}`, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok || !j || j.ok !== true || !j.posts) {
        throw new Error(j?.error || "request_failed");
      }
      const more = Array.isArray(j.posts.items) ? j.posts.items : [];

      setData((prev) => {
        if (!prev || !prev.ok) return prev;
        const prevItems = Array.isArray((prev as any).posts?.items) ? (prev as any).posts.items : [];
        const seen = new Set<string>();
        const merged: any[] = [];

        for (const p of prevItems) {
          if (p && (p as any).id) {
            const id = String((p as any).id);
            if (!seen.has(id)) {
              seen.add(id);
              merged.push(p);
            }
          }
        }

        for (const p of more) {
          if (p && (p as any).id) {
            const id = String((p as any).id);
            if (!seen.has(id)) {
              seen.add(id);
              merged.push(p);
            }
          }
        }

        const nextCur = String(j.posts.nextCursor || "").trim() || null;
        return {
          ...(prev as any),
          posts: {
            ...(prev as any).posts,
            ...j.posts,
            items: merged,
            count: merged.length,
            nextCursor: nextCur,
            hasMore: Boolean(nextCur),
          },
        } as any;
      });
    } catch {
      toast.error("Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  };

  const href = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto px-4 py-6">
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
              onPick={(side) => setActiveIdentitySide(side)}
              onLockedPick={(side) => setLockedSide(side)}
            />

            {!isOwner && lockedSide ? (
              <div className="fixed inset-0 z-[97] flex items-end justify-center md:items-center">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                  onClick={() => setLockedSide(null)}
                  aria-label="Close"
                />
                <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-black text-gray-900">
                        Locked: {SIDES[lockedSide]?.label || lockedSide}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        You can’t view {user?.handle}’s {SIDES[lockedSide]?.label || lockedSide} identity.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLockedSide(null)}
                      className="p-2 rounded-full hover:bg-gray-100"
                      aria-label="Close"
                    >
                      <span className="sr-only">Close</span>
                      <MoreHorizontal size={18} className="text-gray-400" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-700">
                      <div className="font-extrabold text-gray-900">How this works</div>
                      <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                        Only <span className="font-bold">{user?.handle}</span> can place you into their {SIDES[lockedSide]?.label || lockedSide} Side.
                        Nothing you click here unlocks it.
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        They currently show you: <span className="font-black text-gray-900">{SIDES[viewSide]?.label || viewSide}</span>
                      </div>
                    </div>

                    {lockedSide && lockedSide !== "public" ? (
                      <button
                        type="button"
                        disabled={accessReqBusy || accessReqSentFor === lockedSide}
                        onClick={() => void doRequestAccess(lockedSide)}
                        className="w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-900 font-extrabold text-sm hover:bg-gray-50 disabled:opacity-50"
                      >
                        {accessReqSentFor === lockedSide ? "Request sent" : accessReqBusy ? "Sending…" : "Request access"}
                      </button>
                    ) : null}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setLockedSide(null)}
                        className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-extrabold text-sm shadow-md active:scale-95 transition-all"
                      >
                        Got it
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLockedSide(null);
                          setSideSheet(true);
                        }}
                        className="px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-800 font-extrabold text-sm hover:bg-gray-50"
                      >
                        Manage what you show them
                      </button>
                    </div>

                    <div className="text-[11px] text-gray-500">
                      Tip: Your <span className="font-bold">Side</span> action controls what <span className="font-bold">they</span> can access of you.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* sd_717_profile_v2_shell_header_tabs */
            /* sd_732_fix_profile_messageHref */}

            <div className="mt-4">

              <ProfileV2Header
                displaySide={displaySide}
                viewSide={viewSide}
                handle={user.handle}
                facet={facet}
                siders={data?.siders ?? null}
                postsCount={postsCount}
                sharedSets={sharedSets}
                isOwner={isOwner}
                viewerSidedAs={viewerSidedAs}
                onMessage={!isOwner ? doMessage : null}
                messageDisabled={msgBusy}
                actions={
                  isOwner ? (
                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            router.replace("/siddes-profile/prism");
                          } catch {}
                        }}
                        className="w-full py-3 rounded-2xl font-extrabold text-sm text-white shadow-md active:scale-95 transition-all bg-slate-800 hover:bg-slate-900"
                      >
                        Edit identities
                      </button>
                      <div className="flex gap-3">
                        <CopyLinkButton href={href}
              />
                        <button
                  type="button"
                  onClick={() => {
                    try {
                      router.push("/siddes-profile/connections");
                    } catch {}
                  }}
                  className="px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-extrabold text-sm hover:bg-gray-50 transition-all flex items-center justify-center"
                >
                  Connections
                </button>
<button
                          type="button"
                          onClick={() => setActionsOpen(true)}
                          className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-700 font-extrabold text-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                          aria-label="More actions"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                        <SideActionButtons viewerSidedAs={viewerSidedAs} onOpenSheet={() => setSideSheet(true)} />
                      </div>
                      <div className="flex gap-3">
                        <CopyLinkButton href={href} />
                        <button
                          type="button"
                          onClick={() => setActionsOpen(true)}
                          className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-700 font-extrabold text-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                          aria-label="More actions"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </div>
                  )
                }
              />

              <div id="profile-v2-tabs">
              <ProfileV2Tabs side={displaySide} active={contentTab} onPick={pickContentTab} />
            </div>

              {/* Content */}
              <div className="mt-4">
                {contentTab === "posts" ? (
                  <div className="bg-white">
                    {posts.length ? (
                      <>
                        {posts.map((post) => (
                          <PostCard key={post.id} post={post} side={displaySide} variant="row" avatarUrl={avatarUrl} />
                        ))}
                        {postsPayload?.hasMore ? (
                          <div className="py-4 flex justify-center border-t border-gray-100 bg-white">
                            <button
                              type="button"
                              onClick={loadMore}
                              disabled={loadingMore}
                              className="px-4 py-2.5 rounded-xl bg-gray-900 text-white font-extrabold text-sm shadow-sm hover:opacity-90 disabled:opacity-50"
                            >
                              {loadingMore ? "Loading…" : "Load more"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="py-14 text-center px-6 rounded-3xl border border-gray-200 bg-white">
                        <div className="text-sm font-extrabold text-gray-900">No posts visible</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Nothing visible in {SIDES[displaySide]?.label || displaySide}.
                        </div>
                      </div>
                    )}
                  </div>
                ) : contentTab === "media" ? (
                  <div className="py-14 text-center px-6 rounded-3xl border border-gray-200 bg-white">
                    <div className="text-sm font-extrabold text-gray-900">Media</div>
                    <div className="text-xs text-gray-500 mt-1">Media grid coming soon.</div>
                  </div>
                ) : (
                  <div className="py-14 text-center px-6 rounded-3xl border border-gray-200 bg-white">
                    <div className="text-sm font-extrabold text-gray-900">Sets</div>
                    <div className="text-xs text-gray-500 mt-1">Sets tab coming soon.</div>
                  </div>
                )}
              </div>
            </div>

{!isOwner ? (
            <SideWithSheet
              open={sideSheet}
              onClose={() => setSideSheet(false)}
              current={viewerSidedAs}
              busy={busy}
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

