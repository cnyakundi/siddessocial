"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Users, UserCheck, UserPlus } from "lucide-react";

// sd_784_connections_followers_mutuals

type SideKey = "friends" | "close" | "work";

type LedgerItem = {
  id: number;
  handle: string;
  displayName?: string;
  avatarImage?: string;
  side: SideKey;
  updatedAt?: string | null;
};

type LedgerResp = {
  ok: boolean;
  error?: string;
  sides?: Record<string, LedgerItem[]>;
  counts?: Record<string, number>;
};

type TabId = "mutual" | "followers" | "following";

const SIDE_LABEL: Record<SideKey, string> = {
  friends: "Friends",
  close: "Close",
  work: "Work",
};

const SIDE_BADGE: Record<SideKey, string> = {
  friends: "bg-emerald-50 text-emerald-800 border-emerald-200",
  close: "bg-rose-50 text-rose-800 border-rose-200",
  work: "bg-slate-50 text-slate-800 border-slate-200",
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

function flattenLedger(resp: LedgerResp | null): LedgerItem[] {
  const sides = (resp?.sides || {}) as Record<string, LedgerItem[]>;
  const out: LedgerItem[] = [];
  for (const k of Object.keys(sides)) {
    const arr = sides[k] || [];
    for (const it of arr) {
      if (!it || typeof it !== "object") continue;
      const side = String((it as any).side || "").toLowerCase() as SideKey;
      if (side !== "friends" && side !== "close" && side !== "work") continue;
      out.push({ ...it, side });
    }
  }
  out.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return out;
}

function Avatar({ item }: { item: { handle: string; displayName?: string; avatarImage?: string } }) {
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

// sd_948b_connections_directional_ui_safe: make relationship tags calm (dot + text), keep all call sites.
const SIDE_DOT: Record<SideKey, string> = {
  friends: "bg-emerald-500",
  close: "bg-rose-500",
  work: "bg-slate-500",
};

function Badge({ children, side }: { children: React.ReactNode; side: SideKey }) {
  const dot = SIDE_DOT[side] || "bg-gray-300";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
      <span className={"w-1.5 h-1.5 rounded-full " + dot} aria-hidden="true" />
      <span className="text-gray-700">{children}</span>
    </span>
  );
}

function BadgePill({ children, side }: { children: React.ReactNode; side: SideKey }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-1 rounded-full border text-[10px] font-extrabold", SIDE_BADGE[side])}>
      {children}
    </span>
  );
}

export default function ConnectionsPage() {
  const [followers, setFollowers] = useState<LedgerResp | null>(null);
  const [following, setFollowing] = useState<LedgerResp | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabId>("mutual");
  const userPickedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    Promise.all([
      fetch("/api/followers", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ok: false, error: "network_error" })),
      fetch("/api/siders", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ok: false, error: "network_error" })),
    ])
      .then(([a, b]) => {
        if (!alive) return;
        setFollowers(a as LedgerResp);
        setFollowing(b as LedgerResp);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const followersList = useMemo(() => flattenLedger(followers), [followers]);
  const followingList = useMemo(() => flattenLedger(following), [following]);

  const mutuals = useMemo(() => {
    const byId = new Map<number, LedgerItem>();
    for (const it of followingList) byId.set(Number(it.id), it);

    const out: Array<{
      id: number;
      handle: string;
      displayName?: string;
      avatarImage?: string;
      youSide: SideKey;
      theySide: SideKey;
      updatedAt?: string | null;
    }> = [];

    for (const f of followersList) {
      const g = byId.get(Number(f.id));
      if (!g) continue;
      out.push({
        id: Number(f.id),
        handle: f.handle || g.handle,
        displayName: (f.displayName || g.displayName || "").trim(),
        avatarImage: (f.avatarImage || g.avatarImage || "").trim(),
        youSide: g.side,
        theySide: f.side,
        updatedAt: f.updatedAt || g.updatedAt || null,
      });
    }

    out.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return out;
  }, [followersList, followingList]);

  useEffect(() => {
    if (userPickedRef.current) return;
    if (mutuals.length == 0) setTab("followers");
  }, [mutuals.length]);

  const counts = {
    mutual: mutuals.length,
    followers: followersList.length,
    following: followingList.length,
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<any> }> = [
    { id: "mutual", label: "Mutual", icon: UserCheck },
    { id: "followers", label: "They → You", icon: Users },
    { id: "following", label: "You → Them", icon: UserPlus },
  ];

  const pick = (id: TabId) => {
    userPickedRef.current = true;
    setTab(id);
  };

  const trouble =
    (!loading && followers && followers.ok === false) || (!loading && following && following.ok === false);

  return (
    <div className="min-h-dvh">
      <div className="px-4 pt-4 pb-3 sticky top-0 z-10 bg-[#F8F9FA]/90 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between">
          <Link href="/siddes-profile" className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-700 hover:text-gray-900">
            <ChevronLeft size={18} /> Back
          </Link>

          <Link href="/siddes-profile/siders" className="text-xs font-extrabold text-gray-700 hover:text-gray-900">
            Manage
          </Link>
        </div>

        <div className="mt-3">
          <div className="text-lg font-black text-gray-900">Connections</div>
          <div className="text-xs text-gray-500 mt-1">
            They → You: people who placed you into Friends/Close/Work. You → Them: people you placed into your Sides.
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t.id)}
                className={cn(
                  "flex-1 px-3 py-2 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-colors",
                  active ? "bg-white border-gray-300 text-gray-900" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-white"
                )}
                aria-pressed={active}
              >
                <Icon size={16} />
                {t.label}
                <span className="tabular-nums text-[11px] text-gray-400">{counts[t.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-4 max-w-[520px] mx-auto">
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : trouble ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-black text-red-800">Couldn’t load connections</div>
            <div className="text-xs text-red-700 mt-1">Try again after refreshing.</div>
          </div>
        ) : tab === "mutual" ? (
          mutuals.length ? (
            <div className="space-y-2">
              {mutuals.map((m) => {
                const href = profileHref(m.handle);
                const label = (m.displayName || "").trim() || m.handle || "User";
                return (
                  <Link
                    key={m.id}
                    href={href}
                    className="block rounded-2xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors"
                    aria-label={`Open profile ${label}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar item={{ handle: m.handle, displayName: m.displayName, avatarImage: m.avatarImage }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-gray-900 truncate">{label}</div>
                        <div className="text-xs text-gray-500 font-mono truncate">{m.handle}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge side={m.youSide}>You → {SIDE_LABEL[m.youSide]}</Badge>
                          <Badge side={m.theySide}>Them → {SIDE_LABEL[m.theySide]}</Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No mutuals yet. As people add each other to Sides, they’ll show up here.
            </div>
          )
        ) : tab === "followers" ? (
          followersList.length ? (
            <div className="space-y-2">
              {followersList.map((it) => {
                const href = profileHref(it.handle);
                const label = (it.displayName || "").trim() || it.handle || "User";
                return (
                  <Link
                    key={`${it.side}:${it.id}`}
                    href={href}
                    className="block rounded-2xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors"
                    aria-label={`Open profile ${label}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar item={it} />
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-gray-900 truncate">{label}</div>
                        <div className="text-xs text-gray-500 font-mono truncate">{it.handle}</div>
                        <div className="mt-2">
                          <Badge side={it.side}>They → {SIDE_LABEL[it.side]}</Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No one has added you to their Sides yet.</div>
          )
        ) : followingList.length ? (
          <div className="space-y-2">
            {followingList.map((it) => {
              const href = profileHref(it.handle);
              const label = (it.displayName || "").trim() || it.handle || "User";
              return (
                <Link
                  key={`${it.side}:${it.id}`}
                  href={href}
                  className="block rounded-2xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors"
                  aria-label={`Open profile ${label}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar item={it} />
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-gray-900 truncate">{label}</div>
                      <div className="text-xs text-gray-500 font-mono truncate">{it.handle}</div>
                      <div className="mt-2">
                        <Badge side={it.side}>You → {SIDE_LABEL[it.side]}</Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500">You haven’t added anyone to your Sides yet.</div>
        )}
      </div>
    </div>
  );
}


// sd_948b_connections_directional_ui_safe
