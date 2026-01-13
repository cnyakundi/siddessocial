"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getInboxProvider } from "@/src/lib/inboxProvider";
import { SIDES, type SideId } from "@/src/lib/sides";

function setCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
  } catch {}
}

function getCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function parseRelativeToTs(label: string): number | null {
  const v = String(label || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "now") return Date.now();
  const m = v.match(/^(\d+)([smhdw])$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2];
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


function localOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost";
}

function normalizeApiBase(raw: string | undefined | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.origin;
  } catch {
    return null;
  }
}

function isRemoteBase(base: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return new URL(base).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function djangoApiBase(): string | null {
  const base = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE);
  if (!base) return null;
  return isRemoteBase(base) ? base : null;
}

async function fetchWithFallback(
  path: string,
  qs: URLSearchParams,
  init: RequestInit
): Promise<Response> {
  const django = djangoApiBase();

  if (django) {
    try {
      const u = new URL(path, django);
      u.search = qs.toString();
      const res = await fetch(u.toString(), init);
      if (res.status < 500) return res;
    } catch {
      // network/CORS failure -> fallback below
    }
  }

  const u2 = new URL(path, localOrigin());
  u2.search = qs.toString();
  return fetch(u2.toString(), init);
}

type ThreadOpt = {
  id: string;
  title: string;
  lockedSide: string;
  time?: string; // relative label (e.g., 2m, 1h)
  sortTs?: number; // approx absolute timestamp
};

export function InboxStubDebugPanel() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const debug = params.get("debug") === "1";
  const provider = useMemo(() => getInboxProvider(), []);

  const viewerParam = params.get("viewer") || "";
  const sideParam = (params.get("side") || "") as SideId | "";

  // Hooks must be unconditional (lint rules-of-hooks).
  const [selectedThread, setSelectedThread] = useState("t_friends2");
  const [threadSearch, setThreadSearch] = useState("");
  const [threadOptions, setThreadOptions] = useState<ThreadOpt[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  // Keep cookie in sync when viewer param is used.
  useEffect(() => {
    if (!debug) return;
    if (!viewerParam) return;
    setCookie("sd_viewer", viewerParam);
  }, [debug, viewerParam]);

  const cookieViewer = getCookie("sd_viewer") || "";
  const viewer = viewerParam || cookieViewer || "anon";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`);
  };

  // Live fetch thread list for the picker (dev/stub), with pagination.
  useEffect(() => {
    if (!debug) return;

    let alive = true;

    const run = async () => {
      const qsBase = new URLSearchParams();
      if (sideParam) qsBase.set("side", sideParam);
      qsBase.set("limit", "50");

      setThreadsLoading(true);

      const collected: ThreadOpt[] = [];
      const seen = new Set<string>();

      let cursor: string | null = null;
      let hasMore = true;
      let pages = 0;

      // Hard caps so dev UI can't accidentally DDOS itself.
      const MAX_PAGES = 6;   // 6 * 50 = 300 max options
      const MAX_ITEMS = 300;

      try {
        while (alive && hasMore && pages < MAX_PAGES && collected.length < MAX_ITEMS) {
          const qs = new URLSearchParams(qsBase.toString());
          if (cursor) qs.set("cursor", cursor);

          const r = await fetchWithFallback("/api/inbox/threads", qs, {
            cache: "no-store",
            headers: { "x-sd-viewer": viewer },
          });
          const data: any = await r.json().catch(() => ({}));

          const items: any[] = Array.isArray(data?.items) ? data.items : [];
          for (const t of items) {
            const id = String(t?.id || "");
            if (!id) continue;
            if (seen.has(id)) continue;
            seen.add(id);

            const title = String(t?.title || "Thread");
            const lockedSide = String(t?.lockedSide || "");
            const time = String(t?.time || "");
            const updatedAt = Number(t?.updatedAt || 0);
            const sortTs = (Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : (parseRelativeToTs(time) ?? 0));

            collected.push({ id, title, lockedSide, time, sortTs });
          }

          hasMore = Boolean(data?.hasMore);
          cursor = (data?.nextCursor ?? null) as string | null;
          pages += 1;

          // If the API says "hasMore" but doesn't give a cursor, stop to avoid infinite loops.
          if (hasMore && !cursor) hasMore = false;
        }

        if (!alive) return;

        // Sort by recency first (best-effort), then id
        collected.sort((a, b) => (Number(b.sortTs || 0) - Number(a.sortTs || 0)) || a.id.localeCompare(b.id));

        setThreadOptions(collected);

        // If current selection isn't available, pick first thread.
        if (collected.length && !collected.some((x) => x.id === selectedThread)) {
          setSelectedThread(collected[0].id);
        }
      } catch {
        // keep fallback options
      } finally {
        if (!alive) return;
        setThreadsLoading(false);
      }
    };

    void run();

    return () => {
      alive = false;
    };
    // Depend on full query string so `_ts` refreshes also refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debug, viewer, sideParam, params.toString()]);

  if (!debug) return null;

  const sideOptions: Array<{ id: "" | SideId; label: string }> = [
    { id: "", label: "No filter" },
    { id: "public", label: SIDES.public.label },
    { id: "friends", label: SIDES.friends.label },
    { id: "close", label: SIDES.close.label },
    { id: "work", label: SIDES.work.label },
  ];

  const viewerOptions: Array<{ id: string; label: string }> = [
    { id: "me", label: "me (all)" },
    { id: "friends", label: "friends" },
    { id: "close", label: "close" },
    { id: "work", label: "work" },
    { id: "anon", label: "anon" },
  ];

  // Fallback thread list (used if API fetch fails or before it loads)
  const fallbackThreads: ThreadOpt[] = [
    { id: "t_friends2", title: "t_friends2 (Friends)", lockedSide: "friends", time: "5m", sortTs: parseRelativeToTs("5m") ?? 0 },
    { id: "t_close2", title: "t_close2 (Close)", lockedSide: "close", time: "1d", sortTs: parseRelativeToTs("1d") ?? 0 },
    { id: "t_work2", title: "t_work2 (Work)", lockedSide: "work", time: "4h", sortTs: parseRelativeToTs("4h") ?? 0 },
    { id: "t_public1", title: "t_public1 (Public)", lockedSide: "public", time: "30m", sortTs: parseRelativeToTs("30m") ?? 0 },
    { id: "t1", title: "t1 (Mock seed)", lockedSide: "friends", time: "10m", sortTs: parseRelativeToTs("10m") ?? 0 },
    { id: "t2", title: "t2 (Mock seed)", lockedSide: "work", time: "10m", sortTs: parseRelativeToTs("10m") ?? 0 },
    { id: "t3", title: "t3 (Mock seed)", lockedSide: "close", time: "1h", sortTs: parseRelativeToTs("1h") ?? 0 },
  ];

  const rawOpts = threadOptions.length ? threadOptions : fallbackThreads;

  const q = threadSearch.trim().toLowerCase();
  const filteredOpts = q
    ? rawOpts.filter((t) => `${t.id} ${t.title} ${t.lockedSide}`.toLowerCase().includes(q))
    : rawOpts;

  // Ensure filtered list stays sorted by recency.
  const opts = filteredOpts
    .slice()
    .sort((a, b) => (Number(b.sortTs || 0) - Number(a.sortTs || 0)) || a.id.localeCompare(b.id));

  return (
    <div className="mb-3 p-3 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-gray-900">Stub Debug</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Provider: <span className="font-bold">{provider.name}</span>
          </div>
        </div>

        <button
          type="button"
          className="text-[11px] font-bold px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-50"
          onClick={() => update({ debug: null, viewer: null, side: null })}
          title="Hide panel"
        >
          Hide
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-2 rounded-xl border border-gray-100 bg-gray-50">
          <div className="text-[11px] font-bold text-gray-700">Viewer (sd_viewer)</div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {viewerOptions.map((v) => (
              <button
                key={v.id}
                type="button"
                className={
                  "text-xs font-bold px-3 py-1.5 rounded-full border " +
                  (viewer === v.id
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white border-gray-200 text-gray-900 hover:bg-gray-100")
                }
                onClick={() => update({ viewer: v.id })}
                title={`viewer=${v.id}`}
              >
                {v.label}
              </button>
            ))}

            <button
              type="button"
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-900 hover:bg-gray-100"
              onClick={() => update({ viewer: null })}
              title="Remove viewer param"
            >
              clear
            </button>
          </div>

          <div className="mt-2 text-[11px] text-gray-500">
            Active: <span className="font-bold">{viewer}</span>
            {cookieViewer ? (
              <>
                {" "}
                (cookie: <span className="font-bold">{cookieViewer}</span>)
              </>
            ) : null}
          </div>
        </div>

        <div className="p-2 rounded-xl border border-gray-100 bg-gray-50">
          <div className="text-[11px] font-bold text-gray-700">API side filter</div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {sideOptions.map((s) => (
              <button
                key={s.id || "none"}
                type="button"
                className={
                  "text-xs font-bold px-3 py-1.5 rounded-full border " +
                  ((sideParam || "") === s.id
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-900 border-gray-200 hover:bg-gray-100")
                }
                onClick={() => update({ side: s.id || null })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-gray-500">
            side param: <span className="font-bold">{sideParam || "none"}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 p-2 rounded-xl border border-gray-100 bg-gray-50">
        <div className="text-[11px] font-bold text-gray-700">Unread controls</div>

        <div className="mt-2 text-[11px] text-gray-600 font-bold">Thread</div>

        <div className="mt-1">
          <input
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="Search threads…"
            className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white"
            aria-label="Search threads"
          />
          <div className="mt-1 text-[11px] text-gray-500">
            Showing <span className="font-bold">{opts.length}</span> of{" "}
            <span className="font-bold">{rawOpts.length}</span>
            {threadsLoading ? " (loading…)" : ""}
          </div>
        </div>

        <div className="mt-2">
          <select
            value={selectedThread}
            onChange={(e) => setSelectedThread(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white"
            aria-label="Select thread"
          >
            {opts.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} — {t.lockedSide}{t.time ? ` — ${t.time}` : ""}{t.title ? ` — ${t.title}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 flex gap-2 flex-wrap">
          <button
            type="button"
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-900 hover:bg-gray-100"
            onClick={() => {
              // Clear local unread keys (sd.inbox.unread.v0.*)
              try {
                const keys: string[] = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                  const k = window.localStorage.key(i);
                  if (k && k.startsWith("sd.inbox.unread.v0.")) keys.push(k);
                }
                for (const k of keys) window.localStorage.removeItem(k);
              } catch {}
              update({ _ts: String(Date.now()) });
            }}
            title="Clears localStorage unread keys"
          >
            Clear local unread
          </button>

          <button
            type="button"
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-900 hover:bg-gray-100"
            onClick={async () => {
              try {
                const qs = new URLSearchParams();
                await fetchWithFallback("/api/inbox/debug/unread/reset", qs, {
                  method: "POST",
                  headers: { "content-type": "application/json", "x-sd-viewer": viewer },
                  body: JSON.stringify({ threadId: selectedThread }),
                });
              } catch {}
              update({ _ts: String(Date.now()) });
            }}
            title="Clears server unread counters (requires viewer=me)"
          >
            Clear server unread
          </button>

          <button
            type="button"
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-900 hover:bg-gray-100"
            onClick={async () => {
              try {
                const threadId = selectedThread;
                const qs = new URLSearchParams();
                await fetchWithFallback("/api/inbox/debug/incoming", qs, {
                  method: "POST",
                  headers: { "content-type": "application/json", "x-sd-viewer": viewer },
                  body: JSON.stringify({ threadId, text: "Incoming (simulated) message" }),
                });
              } catch {}
              update({ _ts: String(Date.now()) });
            }}
            title="Appends an incoming message from 'them' (requires viewer=me)"
          >
            Simulate incoming
          </button>
        </div>

        <div className="mt-2 text-[11px] text-gray-500">
          Note: server controls require <span className="font-bold">viewer=me</span>.
        </div>
      </div>


      <div className="mt-3 p-2 rounded-xl border border-gray-100 bg-gray-50">
        <div className="text-[11px] font-bold text-gray-700">Side summary</div>

        {(() => {
          const src = (threadOptions.length ? threadOptions : fallbackThreads);
          const total = src.length;
          const counts: Record<string, number> = { public: 0, friends: 0, close: 0, work: 0, other: 0 };
          for (const t of src) {
            const s = String(t.lockedSide || "").toLowerCase();
            if (s in counts) counts[s] += 1;
            else counts.other += 1;
          }
          return (
            <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="p-2 rounded-xl border border-gray-200 bg-white">
                <div className="text-[10px] text-gray-500 font-bold">Total</div>
                <div className="text-sm font-bold text-gray-900">{total}</div>
              </div>
              <div className="p-2 rounded-xl border border-gray-200 bg-white">
                <div className="text-[10px] text-gray-500 font-bold">Public</div>
                <div className="text-sm font-bold text-gray-900">{counts.public}</div>
              </div>
              <div className="p-2 rounded-xl border border-gray-200 bg-white">
                <div className="text-[10px] text-gray-500 font-bold">Friends</div>
                <div className="text-sm font-bold text-gray-900">{counts.friends}</div>
              </div>
              <div className="p-2 rounded-xl border border-gray-200 bg-white">
                <div className="text-[10px] text-gray-500 font-bold">Close</div>
                <div className="text-sm font-bold text-gray-900">{counts.close}</div>
              </div>
              <div className="p-2 rounded-xl border border-gray-200 bg-white">
                <div className="text-[10px] text-gray-500 font-bold">Work</div>
                <div className="text-sm font-bold text-gray-900">{counts.work}</div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="mt-3 text-[11px] text-gray-400">
        Tip: add <span className="font-bold">debug=1</span> to any inbox URL to show this panel.
      </div>
    </div>
  );
}
