"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AtSign, Heart, MessageCircle, Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
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

// sd_804: display-level item can represent a bundle (multiple underlying notification ids)
type DisplayItem = NotificationItem & {
  ids?: string[];
  actors?: string[];
  bundleCount?: number;
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
  return "Mentioned";
}

function IconForType({ t }: { t: NotifType }) {
  if (t === "reply") return <MessageCircle size={16} />;
  if (t === "like") return <Heart size={16} />;
  if (t === "echo") return <Repeat size={16} />;
  return <AtSign size={16} />;
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


function uniqActors(list: string[]): string[] {
  const out: string[] = [];
  for (const a of list || []) {
    const v = String(a || "").trim();
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
    if (out.length >= 12) break; // keep it small
  }
  return out;
}

function actorSummary(actors: string[]): string {
  const a = uniqActors(actors);
  if (a.length <= 1) return a[0] || "Someone";
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  if (a.length === 3) return `${a[0]}, ${a[1]} and 1 other`;
  return `${a[0]}, ${a[1]} and ${a.length - 2} others`;
}

// sd_804: roll up noisy rows into one “Facebook-style” bundle per (type + postId)
function bundleByPost(items: NotificationItem[]): DisplayItem[] {
  const sorted = (items || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const groups = new Map<string, DisplayItem>();
  const out: DisplayItem[] = [];

  for (const it of sorted) {
    const pid = it && it.postId ? String(it.postId) : "";
    if (!pid) {
      out.push({ ...(it as any), ids: [String(it.id)], actors: [String(it.actor || "")], bundleCount: 1 });
      continue;
    }

    const key = `${String(it.type)}|${pid}`;
    const g = groups.get(key);
    if (!g) {
      const first: DisplayItem = { ...(it as any), ids: [String(it.id)], actors: [String(it.actor || "")], bundleCount: 1 };
      // group read = true only if all underlying are read
      first.read = !!(it as any).read;
      groups.set(key, first);
      out.push(first);
    } else {
      const ids = (g.ids || []).slice();
      ids.push(String(it.id));
      g.ids = ids;

      const acts = (g.actors || []).slice();
      acts.push(String(it.actor || ""));
      g.actors = acts;

      g.bundleCount = (g.bundleCount || 1) + 1;

      // If ANY is unread => group is unread
      g.read = Boolean(g.read) && Boolean((it as any)?.read);
  }

  // Finalize actor display + stabilize read flags
  for (const g of out) {
    const ids = (g.ids || []).map((x) => String(x || "").trim()).filter(Boolean);
    g.ids = ids;

    const acts = uniqActors((g.actors || []).map((x) => String(x || "").trim()));
    g.actors = acts;

    if ((g.bundleCount || 1) > 1) {
      g.actor = actorSummary(acts);
    }

    // read=true only if all are read (if any missing, assume unread)
    if ((g.bundleCount || 1) > 1) {
      // We can’t perfectly know if a row lacks a read field; treat falsy as unread.
      // The group’s read field may have been computed during rollup; keep it.
      g.read = !!g.read;
    }
  }

  return out;
}

function Section({
  title,
  items,
  theme,
  onOpen,
}: {
  title: string;
  items: DisplayItem[];
  theme: any;
  onOpen: (n: DisplayItem) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-6">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">{title}</div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {items.map((n) => {
          const postId = n.postId || null;
          return (
            <button
              key={n.id}
              type="button"
              data-post-id={postId ? String(postId) : undefined}
              onClick={() => onOpen(n)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3 border-b border-gray-50 last:border-b-0"
            >
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center border", theme.lightBg, theme.border, theme.text)}>
                <IconForType t={n.type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-gray-900 truncate">{n.actor}</div>
                  <div className="text-[11px] text-gray-400">{new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  <span className="font-bold">{labelForType(n.type)}</span> your post
                  {n.postTitle ? <span className="text-gray-500"> — “{n.postTitle}”</span> : null}
                </div>
                {n.glimpse ? <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{n.glimpse}</div> : null}
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
  const { side } = useSide();
  const meta = SIDES[side];
  const theme = SIDE_THEMES[side];

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    embedded ? <>{children}</> : <div className="px-4 py-6">{children}</div>;

  const [filter, setFilter] = useState<"all" | "mentions" | "replies">("all");
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0); // sd_716: retry without full reload

  const [itemsRaw, setItemsRaw] = useState<NotificationItem[]>([]);

  // sd_801: keep bell badge in sync with local read state
  useEffect(() => {
    try {
      setNotificationsUnread(side, itemsRaw.filter((n) => !n?.read).length);
    } catch {}
  }, [itemsRaw]);
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

const openNotification = (n: DisplayItem) => {
  const nid = String(n?.id || "").trim();
const ids = Array.isArray((n as any)?.ids) && (n as any).ids.length ? (n as any).ids : (nid ? [nid] : []);
const idSet = new Set(ids.map((x: any) => String(x || "").trim()).filter(Boolean));

if (idSet.size && !n?.read) {
  setItemsRaw((prev) => prev.map((x) => (idSet.has(String(x.id)) ? { ...x, read: true } : x)));
  void markRead(Array.from(idSet));
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

  const items = useMemo(() => bundleByPost(dedupe(filtered)), [filtered]);
  const todayItems = useMemo(() => items.filter((n) => isToday(n.ts)), [items]);
  const earlierItems = useMemo(() => items.filter((n) => !isToday(n.ts)), [items]);

  return (
    <Wrapper>
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-gray-900">Alerts</div>
          {/* sd_768_clean_alerts_page_hide_push_debug */}
          <button
            type="button"
            onClick={markAllRead}
            disabled={!canMarkAllRead}
            className={cn(
              "text-xs font-semibold",
              canMarkAllRead ? "text-gray-500 hover:underline" : "text-gray-300 cursor-not-allowed"
            )}
          >
            Mark all read{unreadCount ? " (" + unreadCount + ")" : ""}
          </button>
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold border",
              filter === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("mentions")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold border",
              filter === "mentions" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            )}
          >
            Mentions
          </button>
          <button
            type="button"
            onClick={() => setFilter("replies")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold border",
              filter === "replies" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            )}
          >
            Replies
          </button>
        </div>
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
              <div className={cn("text-sm font-extrabold", theme.text)}>All caught up</div>
              <div className="text-xs text-gray-600 mt-1">No alerts in {meta.label}.</div>
            </div>
          ) : null}
        </>
      )}
    </Wrapper>
  );
}
