"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AtSign, Heart, MessageCircle, Repeat, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import { toast } from "@/src/lib/toast";
import { saveReturnScroll } from "@/src/hooks/returnScroll";
import { setNotificationsUnread } from "@/src/lib/notificationsActivity";

type NotifType = "reply" | "like" | "mention" | "echo";

type NotificationItem = {
  id: string;
  actor: string;
  type: NotifType;
  ts: number; // epoch ms
  glimpse: string;
  postId?: string | null;
  postTitle?: string | null;
  read?: boolean;
};

type NotifsResp = {
  ok: boolean;
  restricted?: boolean;
  viewer?: string | null;
  role?: string;
  count?: number;
  items?: NotificationItem[];
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function labelForType(t: NotifType) {
  if (t === "reply") return "Replied";
  if (t === "like") return "Liked";
  if (t === "echo") return "Echoed";
  return "Mentioned you";
}

function IconForType({ t, size = 16 }: { t: NotifType; size?: number }) {
  if (t === "reply") return <MessageCircle size={size} />;
  if (t === "like") return <Heart size={size} />;
  if (t === "echo") return <Repeat size={size} />;
  return <AtSign size={size} />;
}

function isToday(ts: number) {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function dedupe(items: NotificationItem[]): NotificationItem[] {
  // Keep latest per (actor+type+postId)
  const m = new Map<string, NotificationItem>();
  for (const it of items) {
    const key = `${it.actor}|${it.type}|${it.postId ?? ""}`;
    const prev = m.get(key);
    if (!prev || prev.ts < it.ts) m.set(key, it);
  }
  return Array.from(m.values()).sort((a, b) => b.ts - a.ts);
}

function Section({
  title,
  items,
  theme,
  onOpen,
}: {
  title: string;
  items: NotificationItem[];
  theme: any;
  onOpen: (n: NotificationItem) => void;
}) {
  if (!items.length) return null;

  // Design canon: "New / Earlier". Keep legacy title "Today" for checks.
  const displayTitle = title === "Today" ? "New" : title;

  const iconTone = (t: NotifType) => {
    if (t === "like") return "bg-rose-100 text-rose-500";
    if (t === "reply") return "bg-blue-100 text-blue-500";
    if (t === "echo") return "bg-emerald-100 text-emerald-600";
    return "bg-gray-100 text-gray-700";
  };

  const initialFor = (actor: string) => {
    const a = String(actor || "").trim();
    if (!a) return "?";
    const parts = a.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const second = (parts.length > 1 ? parts[1]?.[0] : "") || "";
    const out = (first + second).toUpperCase();
    return out || a.slice(0, 1).toUpperCase();
  };

  const actionLine = (n: NotificationItem) => {
    if (n.type === "like") return "liked your post";
    if (n.type === "reply") return "replied";
    if (n.type === "echo") return "echoed your post";
    return "mentioned you";
  };

  const timeLabel = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="mb-6">
      <div className="px-1 mb-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
        {displayTitle}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {items.map((n) => {
          const postId = n.postId || null;
          const unread = !n?.read;

          return (
            <button
              key={n.id}
              type="button"
              data-post-id={postId ? String(postId) : undefined}
              onClick={() => onOpen(n)}
              className={cn(
                "py-4 px-5 border-b border-gray-50 last:border-b-0 flex gap-3 relative cursor-pointer active:bg-gray-50 transition-colors text-left w-full",
                unread ? "bg-gray-50/50" : "bg-white",
                "hover:bg-gray-50"
              )}
            >
              {/* Unread dot */}
              {unread ? (
                <div className={cn("absolute top-5 right-5 w-2 h-2 rounded-full shadow-sm", theme.primaryBg)} />
              ) : null}

              {/* Avatar + type icon overlay */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-[12px] font-extrabold text-gray-600">
                  {initialFor(n.actor)}
                </div>
                <div
                  className={cn(
                    "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center",
                    iconTone(n.type)
                  )}
                >
                  <IconForType t={n.type} size={12} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-900 leading-snug">
                    <span className="font-semibold">{n.actor}</span> {actionLine(n)}
                    {n.type === "reply" && n.glimpse ? (
                      <span className="text-gray-700">: “{n.glimpse}”</span>
                    ) : null}
                  </p>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{timeLabel(n.ts)}</span>
                </div>

                {n.type !== "reply" && n.glimpse ? (
                  <div className="mt-1 text-[11px] text-gray-500 line-clamp-2">{n.glimpse}</div>
                ) : null}

                {n.postTitle ? (
                  <div className="mt-2 text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700">Post</span> — “{n.postTitle}”
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NotificationsView({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { side, setSide } = useSide();
const meta = SIDES[side];
  const theme = SIDE_THEMES[side];

  
  const [showSideSheet, setShowSideSheet] = useState(false);
const Wrapper = ({ children }: { children: React.ReactNode }) =>
    embedded ? (
      <div className="w-full max-w-[760px] mx-auto">{children}</div>
    ) : (
      <div className="w-full max-w-[760px] mx-auto px-4 py-6">{children}</div>
    );

  const [filter, setFilter] = useState<"all" | "mentions" | "replies">("all");

  // sd_825_reset_filter_on_side
  useEffect(() => { setFilter("all"); }, [side]);

  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0); // sd_716: retry without full reload

  const [itemsRaw, setItemsRaw] = useState<NotificationItem[]>([]);

  // sd_795_truthful_filters: only show filter chips when data exists (avoid "dead" filters)
  const hasMentions = useMemo(() => itemsRaw.some((n) => n.type === "mention"), [itemsRaw]);
  const hasReplies = useMemo(() => itemsRaw.some((n) => n.type === "reply"), [itemsRaw]);

  useEffect(() => {
    if (filter === "mentions" && !hasMentions) setFilter("all");
    if (filter === "replies" && !hasReplies) setFilter("all");
  }, [filter, hasMentions, hasReplies]);


  // sd_801: keep bell badge in sync with local read state
  useEffect(() => {
    try {
      setNotificationsUnread(side, itemsRaw.filter((n) => !n?.read).length);
    } catch {}
  }, [itemsRaw, side]);
  const unreadCount = useMemo(() => itemsRaw.filter((n) => !n?.read).length, [itemsRaw]);
  const canMarkAllRead = !loading && !restricted && !error && unreadCount > 0;


  const markAllRead = async () => {
    if (!canMarkAllRead) return;
    try {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST", headers: { "x-sd-side": side } });
      if (!res.ok) {
        toast(`Unable to mark read (HTTP ${res.status}).`);
        return;
      }
      setItemsRaw((prev) => prev.map((n) => ({ ...n, read: true })));
      setNotificationsUnread(side, 0);
      toast("Marked all read.");
    } catch {
      toast("Unable to mark read (network error).");
    }
  };


const markRead = async (ids: string[]) => {
  const clean = (ids || []).map((x) => String(x || "").trim()).filter(Boolean);
  if (!clean.length) return;
  try {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "content-type": "application/json", "x-sd-side": side },
      body: JSON.stringify({ ids: clean }),
    });
  } catch {
    // best-effort
  }
};

const openNotification = (n: NotificationItem) => {
  const nid = String(n?.id || "").trim();
  if (nid && !n?.read) {
    setItemsRaw((prev) => prev.map((x) => (x.id === nid ? { ...x, read: true } : x)));
    void markRead([nid]);
  }

  const postId = n.postId || null;
  if (!postId) return toast("No post attached yet.");
  try { saveReturnScroll(String(postId)); } catch {}
  router.push(`/siddes-post/${encodeURIComponent(postId)}`);
};

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // sd_181b: fetch DB-backed notifications
        const res = await fetch("/api/notifications", { cache: "no-store", headers: { "x-sd-side": side } });
        if (!alive) return;

        // Fail-loud: do not mask 404/500 as "All caught up"
        if (!res.ok) {
          setRestricted(false);
          setItemsRaw([]);
          setError(`Unable to load alerts (HTTP ${res.status}).`);
          return;
        }

        const j: NotifsResp = await res.json().catch(() => ({ ok: false } as any));
        if (!alive) return;

        if (j?.restricted) {
          setRestricted(true);
          setItemsRaw([]);
          setError(null);
        } else {
          setRestricted(false);
          setItemsRaw(Array.isArray(j?.items) ? j.items : []);
          try {
            const rows = Array.isArray(j?.items) ? j.items : [];
            const unread = rows.filter((n) => !n?.read).length;
            setNotificationsUnread(side, unread);
          } catch {
            // ignore
          }
          setError(null);
        }
      } catch {
        if (!alive) return;
        setRestricted(false);
        setItemsRaw([]);
        setError("Unable to load alerts (network error).");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [side, retryTick]);

  const filtered = useMemo(() => {
    const all = itemsRaw;
    if (filter === "all") return all;
    if (filter === "mentions") return all.filter((n) => n.type === "mention");
    return all.filter((n) => n.type === "reply");
  }, [filter, itemsRaw]);

  const items = useMemo(() => dedupe(filtered), [filtered]);
  // sd_941_activity_grouping: unread first (New) + read next (Earlier).
  // Keep the legacy "Today/Earlier" titles for checks (UI maps Today -> New).
  const todayItems = useMemo(() => items.filter((n) => !n?.read), [items]);
  const earlierItems = useMemo(() => items.filter((n) => Boolean(n?.read)), [items]);
return (
    <Wrapper>
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className={cn("text-2xl font-bold tracking-tight text-gray-900", embedded ? "" : "")}>
              Activity
            </h1>

            <button
              type="button"
              onClick={() => setShowSideSheet((v) => !v)}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
              aria-label="Choose room"
              title="Choose room"
            >
              <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />
              <span className="text-xs font-extrabold uppercase tracking-wide text-gray-700">
                {meta.label}
              </span>
              <ChevronDown
                size={14}
                className={cn("text-gray-400 transition-transform", showSideSheet ? "rotate-180" : "")}
                aria-hidden="true"
              />
            </button>
          </div>

          {canMarkAllRead ? (
            <button
              type="button"
              onClick={markAllRead}
              disabled={!canMarkAllRead}
              className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
              aria-label="Mark all read"
              title="Mark all read"
            >
              Mark Read
            </button>
          ) : null}
        </div>

        {showSideSheet ? (
          <div className="mt-3 bg-white shadow-xl border border-gray-100 p-2 rounded-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex w-full gap-2 p-1 bg-gray-50/80 rounded-xl border border-gray-100">
              {(["public", "friends", "close", "work"] as SideId[]).map((r) => {
                const active = side === r;
                const t = SIDE_THEMES[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setShowSideSheet(false);
                      setSide(r);
                    }}
                    className={cn(
                      "flex-1 flex items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border",
                      active ? cn("shadow-sm", t.lightBg, t.border, t.text) : "text-gray-400 hover:text-gray-600 hover:bg-white/50 border-transparent"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {SIDES[r].label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* sd_825_chips_gate */}
        {itemsRaw.length ? (
          <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold border",
                filter === "all"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
            >
              All
            </button>

            {hasMentions ? (
              <button
                type="button"
                onClick={() => setFilter("mentions")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold border",
                  filter === "mentions"
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                )}
              >
                Mentions
              </button>
            ) : null}

            {hasReplies ? (
              <button
                type="button"
                onClick={() => setFilter("replies")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold border",
                  filter === "replies"
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                )}
              >
                Replies
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className={cn("p-10 rounded-2xl border text-center", theme.lightBg, theme.border)}>
          <div className={cn("text-sm font-extrabold", theme.text)}>Loading…</div>
          <div className="text-xs text-gray-600 mt-1">Fetching alerts.</div>
        </div>
      ) : error ? (
        <div className={cn("p-10 rounded-2xl border text-center", theme.lightBg, theme.border)}>
          <div className={cn("text-sm font-extrabold", theme.text)}>Alerts unavailable</div>
          <div className="text-xs text-gray-600 mt-1">{error}</div>
          <button
            type="button"
            onClick={() => setRetryTick((x) => x + 1)}
            className="mt-3 inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-bold"
          >
            Retry
          </button>
        </div>
      ) : restricted ? (
        <div className={cn("p-10 rounded-2xl border text-center", theme.lightBg, theme.border)}>
          <div className={cn("text-sm font-extrabold", theme.text)}>Sign in to see alerts</div>
          <div className="text-xs text-gray-600 mt-1">Nothing to show in {meta.label} yet.</div>
        </div>
      ) : (
        <>
          <Section title="Today" items={todayItems} theme={theme} onOpen={openNotification} />
          <Section title="Earlier" items={earlierItems} theme={theme} onOpen={openNotification} />
          {!items.length ? (
            <div className={cn("p-10 rounded-2xl border text-center", theme.lightBg, theme.border)}>
              <div className={cn("text-sm font-extrabold", theme.text)}>
                {filter === "replies" ? "No replies yet" : filter === "mentions" ? "No mentions yet" : "All caught up"}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {filter === "replies"
                  ? `No one has replied in ${meta.label}.`
                  : filter === "mentions"
                    ? `No mentions in ${meta.label}.`
                    : `No alerts in ${meta.label}.`}
              </div>
            </div>
          ) : null}
        </>
      )}
    </Wrapper>
  );
}
