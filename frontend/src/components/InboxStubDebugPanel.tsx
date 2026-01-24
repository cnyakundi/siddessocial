"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { SideId } from "@/src/lib/sides";

const LS_VIEWER = "sd_inbox_stub_viewer";
const LS_SELECTED_THREAD = "sd_inbox_stub_selected_thread";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

// sd_114: In some environments (tests / SSR), window may be unavailable.
// Reference NEXT_PUBLIC_API_BASE as a fallback origin resolver (proxy layer uses it too).
function resolveOrigin(): string {
  if (typeof window !== "undefined" && window.location && window.location.origin) return window.location.origin;

  const raw = process.env.NEXT_PUBLIC_API_BASE;
  const s = String(raw || "").trim();
  if (s) {
    try {
      return new URL(s).origin;
    } catch {
      try {
        return new URL("http://" + s).origin;
      } catch {
        // ignore
      }
    }
  }
  return "http://localhost";
}

function parseRelativeToTs(label: string): number | null {
  const m = String(label || "")
    .trim()
    .match(/^(\d+)([smhdw])$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2].toLowerCase();
  const ms =
    unit === "s"
      ? n * 1_000
      : unit === "m"
      ? n * 60_000
      : unit === "h"
      ? n * 3_600_000
      : unit === "d"
      ? n * 86_400_000
      : unit === "w"
      ? n * 604_800_000
      : 0;
  if (!ms) return null;
  return Date.now() - ms;
}

type ThreadOption = {
  id: string;
  title: string;
  lockedSide: SideId;
  time?: string | null;
  updatedAt?: number | null;
  unread?: number | null;
};

type ThreadsResp = {
  ok?: boolean;
  restricted?: boolean;
  items?: Array<any>;
  hasMore?: boolean;
  nextCursor?: string | null;
  error?: string;
};

const DEFAULT_THREADS: ThreadOption[] = [
  { id: "t_friends2", title: "Nia", lockedSide: "friends", time: "5m" },
  { id: "t_close2", title: "Close Vault", lockedSide: "close", time: "1d" },
  { id: "t_work2", title: "Project Pulse", lockedSide: "work", time: "2h" },
  { id: "t_public_empty", title: "Public (empty thread)", lockedSide: "public", time: "3h" },
];

// Used by debug picker sort. Prefer updatedAt when available; else parse relative time.
function sortTs(t: ThreadOption): number {
  const u = typeof t.updatedAt === "number" && Number.isFinite(t.updatedAt) ? Number(t.updatedAt) : null;
  if (u != null) return u;
  const rel = parseRelativeToTs(String(t.time || "").trim());
  return rel != null ? rel : 0;
}

function dedupeThreads(items: ThreadOption[]): ThreadOption[] {
  const seen: Record<string, 1> = {};
  const out: ThreadOption[] = [];
  for (const t of items) {
    const id = String(t?.id || "").trim();
    if (!id) continue;
    if (seen[id]) continue;
    seen[id] = 1;
    out.push(t);
  }
  return out;
}

export function useInboxStubViewer(): [string, (v: string) => void] {
  const [viewer, setViewer] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_VIEWER);
      if (raw != null) setViewer(String(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_VIEWER, viewer);
    } catch {}
  }, [viewer]);

  return [viewer, setViewer];
}

async function fetchWithFallback(path: string, init?: RequestInit): Promise<Response> {
  const origin = resolveOrigin();
  const url = new URL(path, origin).toString();
  return fetch(url, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(init?.headers || {}),
    },
  });
}

export function InboxStubDebugPanel(props: { viewer: string; onViewer: (v: string) => void }) {
  const { viewer, onViewer } = props;
  if (process.env.NODE_ENV === "production") return null;

  const [threadOptions, setThreadOptions] = useState<ThreadOption[]>(DEFAULT_THREADS);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const [selectedThread, setSelectedThread] = useState<string>(() => {
    try {
      const raw = window.localStorage.getItem(LS_SELECTED_THREAD);
      return String(raw || "t_friends2");
    } catch {
      return "t_friends2";
    }
  });

  const [threadSearch, setThreadSearch] = useState("");

  const [counts, setCounts] = useState<{ public: number; friends: number; close: number; work: number }>({
    public: 0,
    friends: 0,
    close: 0,
    work: 0,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_SELECTED_THREAD, selectedThread);
    } catch {}
  }, [selectedThread]);

  const filteredOptions = useMemo(() => {
    const q = String(threadSearch || "").trim().toLowerCase();
    const base = dedupeThreads(threadOptions);
    const sorted = base
      .slice()
      .sort((a, b) => (sortTs(b) || 0) - (sortTs(a) || 0))
      .map((t) => ({ ...t }));
    if (!q) return sorted;
    return sorted.filter((t) => String(t.title || "").toLowerCase().includes(q) || String(t.id).toLowerCase().includes(q));
  }, [threadOptions, threadSearch]);

  function computeSideCounts(items: ThreadOption[]) {
    const c = { public: 0, friends: 0, close: 0, work: 0 };
    for (const t of items) {
      const s = t.lockedSide;
      if (s === "public") c.public += 1;
      if (s === "friends") c.friends += 1;
      if (s === "close") c.close += 1;
      if (s === "work") c.work += 1;
    }
    return c;
  }

  async function loadThreads(args?: { mode?: "reset" | "more" }) {
    const mode = args?.mode || "reset";
    const useCursor = mode === "more" ? nextCursor : null;

    setThreadsLoading(true);
    setThreadsError(null);

    try {
      const u = new URL("/api/inbox/threads", resolveOrigin());
      if (useCursor) u.searchParams.set("cursor", String(useCursor));
      u.searchParams.set("limit", "20");
      const res = await fetchWithFallback(u.pathname + u.search, { method: "GET" });
      const data: ThreadsResp = await res.json().catch(() => ({} as any));

      if ((data as any)?.restricted) {
        setThreadsError("restricted");
        setThreadOptions(DEFAULT_THREADS);
        setCounts(computeSideCounts(DEFAULT_THREADS));
        setNextCursor(null);
        setHasMore(false);
        setCursor(useCursor);
        return;
      }

      const rawItems = Array.isArray((data as any)?.items) ? ((data as any).items as any[]) : [];
      const mapped: ThreadOption[] = rawItems.map((it: any) => {
        const id = String(it?.id || "");
        const title = String(it?.title || "");
        const lockedSide = (String(it?.lockedSide || it?.side || "friends") as SideId) || "friends";
        const time = it?.time != null ? String(it.time) : null;
        const updatedAt =
          typeof it?.updatedAt === "number" && Number.isFinite(it.updatedAt)
            ? Number(it.updatedAt)
            : it?.updatedAt
            ? Number(it.updatedAt)
            : null;
        const unread = typeof it?.unread === "number" ? Number(it.unread) : it?.unread != null ? Number(it.unread) : null;
        return { id, title, lockedSide, time, updatedAt, unread };
      });

      const merged = mode === "more" ? dedupeThreads([...threadOptions, ...mapped]) : dedupeThreads(mapped);
      setThreadOptions(merged);
      setCounts(computeSideCounts(merged));

      const nc = (data as any)?.nextCursor != null ? String((data as any).nextCursor) : null;
      const hm = Boolean((data as any)?.hasMore);
      setNextCursor(nc);
      setHasMore(hm);
      setCursor(useCursor);
    } catch (e: any) {
      setThreadsError(String(e?.message || e || "unknown"));
    } finally {
      setThreadsLoading(false);
    }
  }

  useEffect(() => {
    // On mount, try to load live list once.
    loadThreads({ mode: "reset" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function clearLocalUnread() {
    // local-only: just reload
    await loadThreads({ mode: "reset" });
  }

  async function clearServerUnread() {
    // sd_114: ensure we hit DRF debug when configured.
    await fetchWithFallback("/api/inbox/debug/unread/reset", { method: "POST" });
    await loadThreads({ mode: "reset" });
  }

  async function simulateIncoming() {
    await fetchWithFallback("/api/inbox/debug/incoming", {
      method: "POST",
      body: JSON.stringify({ threadId: selectedThread, text: "👋 incoming" }),
      headers: { "content-type": "application/json" },
    });
    await loadThreads({ mode: "reset" });
  }

  return (
    <div
      className={cn("fixed bottom-3 right-3 z-[999] w-[320px] rounded-2xl border border-gray-200 bg-white shadow-lg p-3")}
      aria-label="Inbox debug panel"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-black text-gray-700">DEV • Inbox Debug</div>
        <button
          type="button"
          className="text-[11px] font-bold text-gray-500 hover:text-gray-700"
          onClick={() => onViewer("")}
          aria-label="Clear viewer"
          title="Clear"
        >
          Clear
        </button>
      </div>

      <div className="mt-2">
        <label className="block text-[11px] font-bold text-gray-500">x-sd-viewer</label>
        <input
          value={viewer}
          onChange={(e) => onViewer(e.target.value)}
          placeholder="me | @handle | anon"
          className="mt-1 w-full px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
        />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-black text-gray-700">Side summary</div>
          <button
            type="button"
            className="text-[11px] font-bold text-gray-500 hover:text-gray-700"
            onClick={() => loadThreads({ mode: "reset" })}
            aria-label="Refresh threads"
          >
            Refresh
          </button>
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-2">
            <div className="text-[10px] font-bold text-gray-500">Public</div>
            <div className="text-sm font-black text-gray-800">{counts.public}</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-2">
            <div className="text-[10px] font-bold text-gray-500">Friends</div>
            <div className="text-sm font-black text-gray-800">{counts.friends}</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-2">
            <div className="text-[10px] font-bold text-gray-500">Close</div>
            <div className="text-sm font-black text-gray-800">{counts.close}</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-2">
            <div className="text-[10px] font-bold text-gray-500">Work</div>
            <div className="text-sm font-black text-gray-800">{counts.work}</div>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-[11px] font-bold text-gray-500">Search threads</label>
          <input
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="Search threads"
            className="mt-1 w-full px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
          />
        </div>

        <div className="mt-3">
          <label className="block text-[11px] font-bold text-gray-500">Select thread</label>
          <select
            value={selectedThread}
            onChange={(e) => setSelectedThread(e.target.value)}
            className="mt-1 w-full px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
            aria-label="Select thread"
          >
            {filteredOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} · {t.lockedSide}
                {t.unread ? ` · ${t.unread} unread` : ""}
              </option>
            ))}
          </select>

          <div className="mt-1 text-[10px] text-gray-400">
            threadId: selectedThread = <span className="font-mono">{selectedThread}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-[11px] font-black text-gray-700 hover:bg-gray-50"
            onClick={clearLocalUnread}
          >
            Clear local unread
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-[11px] font-black text-gray-700 hover:bg-gray-50"
            onClick={clearServerUnread}
          >
            Clear server unread
          </button>
        </div>

        <div className="mt-2">
          <button
            type="button"
            className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-[11px] font-black text-gray-700 hover:bg-gray-50"
            onClick={simulateIncoming}
          >
            Simulate incoming
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[10px] text-gray-400">{threadsLoading ? "Loading…" : threadsError ? `Error: ${threadsError}` : ""}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-black text-gray-700 hover:bg-gray-50"
              onClick={() => loadThreads({ mode: "more" })}
              disabled={!hasMore || threadsLoading}
              aria-disabled={!hasMore || threadsLoading}
            >
              Load more
            </button>
          </div>
        </div>

        <div className="mt-1 text-[10px] text-gray-400">
          cursor={String(cursor || "")} · nextCursor={String(nextCursor || "")} · hasMore={String(hasMore)}
        </div>
      </div>
    </div>
  );
}

