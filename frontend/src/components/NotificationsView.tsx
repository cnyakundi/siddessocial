"use client";

import React, { useMemo, useState } from "react";
import { AtSign, Heart, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { MOCK_NOTIFICATIONS, type NotifType, type NotificationItem } from "@/src/lib/mockNotifications";
import { useSide } from "@/src/components/SideProvider";
import { SIDE_THEMES } from "@/src/lib/sides";
import { notifToPostId } from "@/src/lib/postLookup";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function labelForType(t: NotifType) {
  if (t === "reply") return "Replied";
  if (t === "like") return "Liked";
  return "Mentioned you";
}

function IconForType({ t }: { t: NotifType }) {
  if (t === "reply") return <MessageCircle size={16} />;
  if (t === "like") return <Heart size={16} />;
  return <AtSign size={16} />;
}

function isToday(ts: number) {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function dedupe(items: NotificationItem[]): NotificationItem[] {
  // Keep latest per (actor,type) within last 24h window (simple)
  const out: NotificationItem[] = [];
  const seen = new Map<string, NotificationItem>();
  for (const n of items.sort((a, b) => b.ts - a.ts)) {
    const k = `${n.actor}::${n.type}`;
    if (!seen.has(k)) {
      seen.set(k, n);
      out.push(n);
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
}

function Section({ title, items, theme, router }: { title: string; items: NotificationItem[]; theme: any; router: any }) {
  if (!items.length) return null;
  return (
    <div className="mb-6">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">{title}</div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {items.map((n) => {
          const postId = notifToPostId(n.id);
          return (
            <div key={n.id} className={cn("p-4 border-b border-gray-50 border-l-2", n.type === "mention" ? cn(theme.lightBg, theme.accentBorder) : "bg-white border-l-transparent")}>
              <div className="flex gap-3">
                <div className={cn("w-2 h-2 mt-2 rounded-full", theme.primaryBg)} />
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <span>{n.actor}</span>
                      <span className="text-gray-400 text-xs">{labelForType(n.type)}</span>
                    </div>
                    <span className="text-xs text-gray-400">{n.time}</span>
                  </div>

                  <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                    <span className="text-gray-400"><IconForType t={n.type} /></span>
                    <span>{n.type === "mention" ? "Mentioned you:" : n.type === "reply" ? "Replied:" : "Liked your post"}</span>
                  </div>

                  <div className="bg-white border border-gray-100 p-3 rounded-lg text-xs text-gray-600 shadow-sm">
                    “{n.glimpse}”
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button type="button" className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                      onClick={() => { if (postId) router.push(`/siddes-post/${postId}?reply=1&from=notif`); else alert("Not available."); }}>
                      Reply
                    </button>
                    <button type="button" className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                      onClick={() => { if (postId) router.push(`/siddes-post/${postId}?from=notif`); else alert("Not available."); }}>
                      Open
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div className="p-3 text-center text-xs text-gray-400">End</div>
      </div>
    </div>
  );
}

export function NotificationsView() {
  const router = useRouter();
  const { side } = useSide();
  const theme = SIDE_THEMES[side];

  const [filter, setFilter] = useState<"all" | "mentions" | "replies">("all");

  const filtered = useMemo(() => {
    if (filter === "all") return MOCK_NOTIFICATIONS;
    if (filter === "mentions") return MOCK_NOTIFICATIONS.filter((n) => n.type === "mention");
    return MOCK_NOTIFICATIONS.filter((n) => n.type === "reply");
  }, [filter]);

  const items = useMemo(() => dedupe(filtered), [filtered]);

  const todayItems = useMemo(() => items.filter((n) => isToday(n.ts)), [items]);
  const earlierItems = useMemo(() => items.filter((n) => !isToday(n.ts)), [items]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Notifications</h1>
          <button className="text-xs font-semibold text-gray-500 hover:underline">Mark all read</button>
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          <button type="button" onClick={() => setFilter("all")} className={cn("px-3 py-1 rounded-full text-xs font-bold", filter === "all" ? cn(theme.primaryBg, "text-white") : "bg-gray-100 text-gray-600")}>All</button>
          <button type="button" onClick={() => setFilter("mentions")} className={cn("px-3 py-1 rounded-full text-xs font-bold", filter === "mentions" ? cn(theme.primaryBg, "text-white") : "bg-gray-100 text-gray-600")}>Mentions</button>
          <button type="button" onClick={() => setFilter("replies")} className={cn("px-3 py-1 rounded-full text-xs font-bold", filter === "replies" ? cn(theme.primaryBg, "text-white") : "bg-gray-100 text-gray-600")}>Replies</button>
        </div>
      </div>

      <Section title="Today" items={todayItems} theme={theme} router={router} />
      <Section title="Earlier" items={earlierItems} theme={theme} router={router} />

      {!items.length ? <div className="p-10 text-center text-gray-400">No notifications.</div> : null}
    </div>
  );
}
