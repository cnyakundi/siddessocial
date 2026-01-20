"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDE_THEMES, SIDES } from "@/src/lib/sides";

type SetItem = {
  id: string;
  side: SideId;
  label: string;
  members: string[];
  color?: string;
};

type SetsResp = {
  ok?: boolean;
  items?: SetItem[];
  error?: string;
};

function normQ(q: string): string {
  return String(q || "").trim().toLowerCase();
}

function includesCI(hay: string, needle: string): boolean {
  return String(hay || "").toLowerCase().includes(needle);
}

export default function SearchPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialQ = useMemo(() => String(sp?.get("q") || ""), [sp]);
  const [q, setQ] = useState(initialQ);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bySide, setBySide] = useState<Record<string, SetItem[]>>({});

  const qn = useMemo(() => normQ(q), [q]);

  async function fetchSets(side: SideId): Promise<SetItem[]> {
    const res = await fetch(`/api/sets?side=${side}`, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as SetsResp;
    if (!res.ok) return [];
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((it: any) => ({
      id: String(it?.id || ""),
      side,
      label: String(it?.label || ""),
      members: Array.isArray(it?.members) ? it.members.map((m: any) => String(m || "")).filter(Boolean) : [],
      color: it?.color,
    }));
  }

  async function runSearch(nextQ?: string) {
    const useQ = normQ(typeof nextQ === "string" ? nextQ : q);
    setErr(null);

    const params = new URLSearchParams(sp ? Array.from(sp.entries()) : []);
    if (useQ) params.set("q", useQ);
    else params.delete("q");
    router.replace(`/search?${params.toString()}`);

    if (!useQ) {
      setBySide({});
      return;
    }

    setLoading(true);
    try {
      const sides: SideId[] = ["friends", "close", "work", "public"];
      const results = await Promise.all(sides.map((s) => fetchSets(s)));

      const next: Record<string, SetItem[]> = {};
      for (let i = 0; i < sides.length; i++) {
        const side = sides[i];
        const items = results[i] || [];
        next[side] = items.filter((it) => includesCI(it.label, useQ) || it.members.some((m) => includesCI(m, useQ)));
      }
      setBySide(next);
    } catch {
      setErr("Search failed (network).");
      setBySide({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const qq = normQ(initialQ);
    if (qq) void runSearch(qq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(() => {
    let n = 0;
    for (const sid of Object.keys(bySide)) n += (bySide[sid] || []).length;
    return n;
  }, [bySide]);

  return (
    <div className="min-h-[80vh] px-4 py-10 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-black text-gray-900">Search</div>
            <div className="text-sm text-gray-500 mt-1">Search your Sets across Sides.</div>
          </div>
          <Link
            href="/siddes-feed"
            className="px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Back to feed
          </Link>
        </div>

        <div className="mt-6 p-4 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-gray-100 border border-gray-200">
              <Search size={16} className="text-gray-700" />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
              placeholder="Search Sets by name or member handle..."
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-300"
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={!qn || loading}
              className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {err ? <div className="text-sm text-rose-600 mt-3">{err}</div> : null}

          {qn ? (
            <div className="mt-3 text-xs text-gray-500">
              Query: <span className="font-mono">{qn}</span> • Results: <span className="font-bold">{total}</span>
            </div>
          ) : (
            <div className="mt-3 text-xs text-gray-500">Tip: Try a set name (e.g., "family") or a handle (e.g., "@ali").</div>
          )}
        </div>

        {qn ? (
          <div className="mt-6 space-y-4">
            {SIDE_ORDER.map((sid) => {
              const items = bySide[sid] || [];
              const theme = SIDE_THEMES[sid];
              if (!items.length) return null;

              return (
                <div key={sid} className="p-4 rounded-2xl border border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={"px-2 py-1 rounded-full border text-xs font-extrabold " + theme.lightBg + " " + theme.text + " " + theme.border}>
                        {SIDES[sid].label}
                      </span>
                      <div className="text-sm font-extrabold text-gray-900">Sets</div>
                    </div>
                    <div className="text-xs font-bold text-gray-500">{items.length}</div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {items.slice(0, 25).map((it) => (
                      <div key={it.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-gray-900 truncate">{it.label}</div>
                          <div className="text-xs text-gray-500 truncate">
                            Members: {it.members.slice(0, 6).join(", ")}
                            {it.members.length > 6 ? ` +${it.members.length - 6} more` : ""}
                          </div>
                        </div>
                        <Link
                          href={`/siddes-sets?side=${sid}`}
                          className="px-3 py-2 rounded-full bg-white border border-gray-200 text-xs font-extrabold text-gray-700 hover:bg-gray-100"
                        >
                          Open
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {total === 0 ? (
              <div className="p-6 rounded-2xl border border-gray-200 bg-white text-center">
                <div className="text-lg font-extrabold text-gray-900">No results</div>
                <div className="text-sm text-gray-500 mt-1">Try a different keyword.</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
