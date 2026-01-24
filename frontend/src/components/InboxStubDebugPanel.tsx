"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { SideId } from "@/src/lib/sides";

// sd_563: Inbox debug panel live thread fetch + pagination (and hook-safe wrapper)

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
    .match(/^(d+)([smhdw])$/i);
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
    const id = String((t as any)?.id || "").trim();
    if (!id) continue;
    if (seen[id]) continue;
    seen[id] = 1;
    out.push(t);
  }
  return out;
}

// sd_114: Debug panel should work whether you're using Next stub routes or Django DRF.
// - Prefer same-origin Next routes (/api/*).
// - If that fails (network / 404), fall back to NEXT_PUBLIC_API_BASE origin.
async function fetchWithFallback(path: string, init: RequestInit): Promise<Response> {
  const origin1 = resolveOrigin();
  const url1 = new URL(path, origin1).toString();

  try {
    const r1 = await fetch(url1, init);
    if (r1.status !== 404) return r1;
  } catch {
    // fall through
  }

  const raw = process.env.NEXT_PUBLIC_API_BASE;
  const s = String(raw || "").trim();
  if (!s) {
    return new Response(JSON.stringify({ ok: false, error: "network_error" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  let origin2 = "";
  try {
    origin2 = new URL(s).origin;
  } catch {
    try {
      origin2 = new URL("http://" + s).origin;
    } catch {
      origin2 = "";
    }
  }

  if (!origin2 || origin2 === origin1) {
    return new Response(JSON.stringify({ ok: false, error: "network_error" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const url2 = new URL(path, origin2).toString();
    return await fetch(url2, init);
  } catch (e: any) {
    const detail = String(e?.message || "network_error");
    return new Response(JSON.stringify({ ok: false, error: "network_error", detail }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

export function InboxStubDebugPanel(props: { viewer: string; onViewer: (v: string) => void }) {
  // Dev-only panel: wrapper avoids conditional-hook lint in production builds.
  if (process.env.NODE_ENV === "production") return null;
  return <InboxStubDebugPanelInner {...props} />;
}

function InboxStubDebugPanelInner(props: { viewer: string; onViewer: (v: string) => void }) {
  const { viewer, onViewer } = props;

  const viewerTrim = String(viewer || "").trim();
  const viewerHeader = viewerTrim ? viewerTrim : "";

  // Live thread fetch wiring
  const [threadOptions, setThreadOptions] = useState<ThreadOption[]>(DEFAULT_THREADS);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [selectedThread, setSelectedThread] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_THREADS[0]?.id || "";
    try {
      const raw = window.localStorage.getItem(LS_SELECTED_THREAD);
      return raw ? String(raw) : (DEFAULT_THREADS[0]?.id || "");
    } catch {
      return DEFAULT_THREADS[0]?.id || "";
    }
  });

  const [incomingText, setIncomingText] = useState("Incoming message");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_SELECTED_THREAD, selectedThread);
    } catch {}
  }, [selectedThread]);

  async function fetchThreads(opts?: { cursor?: string | null; append?: boolean }) {
    setThreadsLoading(true);
    setStatus(null);

    const cursor = opts?.cursor ? String(opts.cursor) : null;

    try {
      const origin = resolveOrigin();
      const u = new URL("/api/inbox/threads", origin); // /api/inbox/threads
      u.searchParams.set("limit", "25");
      if (cursor) u.searchParams.set("cursor", cursor);

      const headers = new Headers({ accept: "application/json" });
      if (viewerHeader) headers.set("x-sd-viewer", viewerHeader);

      const res = await fetchWithFallback(u.pathname + u.search, {
        method: "GET",
        credentials: "include",
        headers,
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as ThreadsResp | null;

      if (!res.ok || !data) {
        setStatus(`Threads fetch failed (${res.status})`);
        setThreadOptions(DEFAULT_THREADS);
        setHasMore(false);
        setNextCursor(null);
        return;
      }

      if (data.restricted) {
        setStatus("restricted (missing viewer)");
        setThreadOptions(DEFAULT_THREADS);
        setHasMore(false);
        setNextCursor(null);
        return;
      }

      const rawItems = Array.isArray(data.items) ? data.items : [];
      const mapped: ThreadOption[] = rawItems
        .map((t: any) => ({
          id: String(t?.id || "").trim(),
          title: String(t?.title || t?.id || "Thread"),
          lockedSide: (String(t?.lockedSide || "friends") as SideId) || "friends",
          time: t?.time != null ? String(t.time) : null,
          updatedAt: typeof t?.updatedAt === "number" ? Number(t.updatedAt) : null,
          unread: typeof t?.unread === "number" ? Number(t.unread) : null,
        }))
        .filter((t) => Boolean(t.id));

      const next = typeof data.nextCursor === "string" && data.nextCursor ? String(data.nextCursor) : null;
      const more = Boolean(data.hasMore) && !!next;

      setNextCursor(next);
      setHasMore(more);

      setThreadOptions((prev) => {
        const merged = opts?.append ? dedupeThreads([...(prev || []), ...mapped]) : dedupeThreads(mapped);
        const finalList = merged.length ? merged : DEFAULT_THREADS;

        // Keep selection stable, but if it's empty, pick the first fetched thread.
        if (!selectedThread && merged.length) setSelectedThread(merged[0].id);
        if (selectedThread && merged.length && !merged.some((x) => x.id === selectedThread)) {
          setSelectedThread(merged[0].id);
        }

        return finalList;
      });
    } finally {
      setThreadsLoading(false);
    }
  }

  useEffect(() => {
    // Auto-refresh when viewer changes (or on first mount).
    fetchThreads({ cursor: null, append: false }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerHeader]);

  const counts = useMemo(() => {
    const base = { public: 0, friends: 0, close: 0, work: 0 };
    for (const t of threadOptions) {
      const s = String(t.lockedSide || "") as SideId;
      if (s === "public") base.public += 1;
      if (s === "friends") base.friends += 1;
      if (s === "close") base.close += 1;
      if (s === "work") base.work += 1;
    }
    return base;
  }, [threadOptions]);

  const shownThreads = useMemo(() => {
    const q = String(threadSearch || "").trim().toLowerCase();
    const items = [...threadOptions].sort((a, b) => sortTs(b) - sortTs(a));
    if (!q) return items;
    return items.filter((t) => {
      const id = String(t.id || "").toLowerCase();
      const title = String(t.title || "").toLowerCase();
      return id.includes(q) || title.includes(q);
    });
  }, [threadOptions, threadSearch]);

  async function clearLocalUnread() {
    // Local UI helpers can listen for this event; safe no-op otherwise.
    try {
      window.dispatchEvent(new CustomEvent("sd_inbox_clear_local_unread", { detail: { threadId: selectedThread } }));
    } catch {}
    setStatus("Local unread cleared.");
  }

  async function clearServerUnread() {
    setStatus("Clearing server unread…");
    const headers = new Headers({ accept: "application/json", "content-type": "application/json" });
    if (viewerHeader) headers.set("x-sd-viewer", viewerHeader);

    const res = await fetchWithFallback("/api/inbox/debug/unread/reset", {
      method: "POST",
      credentials: "include",
      headers,
      cache: "no-store",
      body: JSON.stringify({ threadId: selectedThread }),
    });

    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setStatus(`Clear server unread failed (${res.status})`);
      return;
    }
    if (data?.restricted) {
      setStatus(`restricted (${String(data?.role || "anon")})`);
      return;
    }
    setStatus("Server unread cleared.");
    // Refresh list to reflect unread changes
    fetchThreads({ cursor: null, append: false }).catch(() => {});
  }

  async function simulateIncoming() {
    setStatus("Simulating incoming…");
    const headers = new Headers({ accept: "application/json", "content-type": "application/json" });
    if (viewerHeader) headers.set("x-sd-viewer", viewerHeader);

    const res = await fetchWithFallback("/api/inbox/debug/incoming", {
      method: "POST",
      credentials: "include",
      headers,
      cache: "no-store",
      body: JSON.stringify({ threadId: selectedThread, text: incomingText }),
    });

    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setStatus(`Simulate incoming failed (${res.status})`);
      return;
    }
    if (data?.restricted) {
      setStatus(`restricted (${String(data?.role || "anon")})`);
      return;
    }
    setStatus("Incoming appended.");
    fetchThreads({ cursor: null, append: false }).catch(() => {});
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
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-black text-gray-700 hover:bg-gray-50"
            onClick={() => onViewer("me")}
          >
            me
          </button>
          <button
            type="button"
            className="px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-black text-gray-700 hover:bg-gray-50"
            onClick={() => onViewer("anon")}
          >
            anon
          </button>
          <button
            type="button"
            className="ml-auto px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-black text-gray-700 hover:bg-gray-50"
            onClick={() => fetchThreads({ cursor: null, append: false })}
          >
            {threadsLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 p-2">
          <div className="text-[11px] font-black text-gray-700">Side summary</div>
          <div className="mt-1 grid grid-cols-4 gap-2 text-[11px] font-bold text-gray-600">
            <div className="text-center">
              Public<br />
              <span className="text-gray-900">{counts.public}</span>
            </div>
            <div className="text-center">
              Friends<br />
              <span className="text-gray-900">{counts.friends}</span>
            </div>
            <div className="text-center">
              Close<br />
              <span className="text-gray-900">{counts.close}</span>
            </div>
            <div className="text-center">
              Work<br />
              <span className="text-gray-900">{counts.work}</span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-[11px] font-bold text-gray-500">Search threads</label>
          <input
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="name or id…"
            className="mt-1 w-full px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
          />
        </div>

        <div className="mt-3">
          <label className="block text-[11px] font-bold text-gray-500">Select thread</label>
          <select
            className="mt-1 w-full px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
            value={selectedThread}
            onChange={(e) => setSelectedThread(e.target.value)}
          >
            {shownThreads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} • {t.lockedSide} {t.unread ? `• ${t.unread}` : ""}
              </option>
            ))}
          </select>

          {hasMore ? (
            <button
              type="button"
              className="mt-2 w-full px-2.5 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-black text-gray-700 hover:bg-gray-50"
              onClick={() => (nextCursor ? fetchThreads({ cursor: nextCursor, append: true }) : null)}
              disabled={threadsLoading || !nextCursor}
            >
              {threadsLoading ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 p-2">
          <div className="text-[11px] font-black text-gray-700">Unread tools</div>
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              className="w-full px-2.5 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-black text-gray-700 hover:bg-gray-50"
              onClick={clearLocalUnread}
            >
              Clear local unread
            </button>
            <button
              type="button"
              className="w-full px-2.5 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-black text-gray-700 hover:bg-gray-50"
              onClick={clearServerUnread}
            >
              Clear server unread
            </button>

            <div className="flex gap-2">
              <input
                value={incomingText}
                onChange={(e) => setIncomingText(e.target.value)}
                className="flex-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
                placeholder="incoming text…"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-black text-gray-700 hover:bg-gray-50"
                onClick={simulateIncoming}
              >
                Simulate incoming
              </button>
            </div>
          </div>
        </div>

        {status ? <div className="mt-2 text-[11px] text-gray-500">{status}</div> : null}

        <div className="mt-2 text-[10px] text-gray-400">
          Viewer forwarded via header/cookie (never via URL). Thread list fetched live from /api/inbox/threads.
        </div>
      </div>
    </div>
  );
}
