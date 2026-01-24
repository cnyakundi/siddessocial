"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ShieldAlert, Users, Heart, Briefcase } from "lucide-react";

import { toast } from "@/src/lib/toast";

type SideKey = "friends" | "close" | "work";

type SiderItem = {
  id: number;
  handle: string;
  displayName?: string;
  avatarImage?: string;
  side: SideKey;
  updatedAt?: string | null;
};

type SidersResp = {
  ok: boolean;
  error?: string;
  sides?: Record<string, SiderItem[]>;
  counts?: Record<string, number>;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function SideIcon({ side, className }: { side: SideKey; className?: string }) {
  const Icon = side === "friends" ? Users : side === "close" ? Heart : Briefcase;
  return <Icon className={className} />;
}

export default function SidersAccessRosterPage() {
  const [data, setData] = useState<SidersResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SideKey>("friends");
  const [busyId, setBusyId] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/siders", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as any;
      if (j && typeof j === "object") setData(j as SidersResp);
      else setData({ ok: false, error: "bad_response" });
    } catch {
      setData({ ok: false, error: "network_error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);
  const items = useMemo(() => {
    const sides = (data?.sides || {}) as Record<string, SiderItem[]>;
    const arr = (sides[active] || []) as SiderItem[];
    return arr.slice();
  }, [data?.sides, active]);

  async function postSide(usernameOrHandle: string, side: SideKey | "public") {
    const body: any = { username: usernameOrHandle, side };
    // sd_530 compatibility: Close/Work requires explicit confirm
    if (side === "close" || side === "work") body.confirm = true;

    const res = await fetch("/api/side", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => null)) as any;
    return { ok: !!j?.ok, error: j?.error || (res.ok ? null : "http_error") };
  }

  async function restoreAccess(handle: string, prev: SideKey) {
    setBusyId(handle);
    try {
      // Close is special: server requires Friends first.
      if (prev === "close") {
        const a = await postSide(handle, "friends");
        if (!a.ok) {
          toast.error(a.error ? String(a.error) : "Could not restore");
          return;
        }
        const b = await postSide(handle, "close");
        if (!b.ok) {
          toast.error(b.error ? String(b.error) : "Could not restore");
          return;
        }
      } else {
        const out = await postSide(handle, prev);
        if (!out.ok) {
          toast.error(out.error ? String(out.error) : "Could not restore");
          return;
        }
      }

      toast.success("Restored");
      await load();
    } finally {
      setBusyId("");
    }
  }

  async function removeAccess(it: SiderItem) {
    const prev = it.side;
    setBusyId(it.handle);
    try {
      const out = await postSide(it.handle, "public");
      if (!out.ok) {
        toast.error(out.error ? String(out.error) : "Could not update");
        return;
      }

      toast.undo("Access removed", () => {
        void restoreAccess(it.handle, prev);
      });

      await load();
    } finally {
      setBusyId("");
    }
  }

  async function downgradeToFriends(it: SiderItem) {
    const prev = it.side;
    setBusyId(it.handle);
    try {
      const out = await postSide(it.handle, "friends");
      if (!out.ok) {
        toast.error(out.error ? String(out.error) : "Could not update");
        return;
      }

      toast.undo("Moved to Friends", () => {
        void restoreAccess(it.handle, prev);
      });

      await load();
    } finally {
      setBusyId("");
    }
  }

  const headerCount = typeof data?.counts?.[active] === "number" ? data?.counts?.[active] : items.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <SideIcon side={active} className="w-4 h-4 text-gray-600" />
              <div className="text-sm font-black text-gray-900">Access</div>
            </div>
            <div className="text-xs text-gray-500 mt-1">This is your <span className="font-semibold">access list</span>: people who can see <span className="font-semibold">you</span> in each Side.</div>
          </div>

          <Link
            href="/siddes-profile/account"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 mt-0.5" />
            <div>
              <div className="text-sm font-extrabold">Safety</div>
              <div className="text-xs mt-1 text-amber-800">Close/Work are permissions you grant. Remove access anytime — and Undo if it was a mistake.</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {(["friends", "close", "work"] as SideKey[]).map((s) => {
            const activeTab = s === active;
            const label = s === "friends" ? "Friends" : s === "close" ? "Close" : "Work";
            const c = typeof data?.counts?.[s] === "number" ? data?.counts?.[s] : (data?.sides?.[s]?.length || 0);
            return (
              <button
                key={s}
                type="button"
                onClick={() => setActive(s)}
                className={cn(
                  "px-3 py-2 rounded-full border text-xs font-extrabold",
                  activeTab ? "bg-white border-gray-300 text-gray-900" : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {label} <span className="ml-1 text-[11px] text-gray-400">{c}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-extrabold text-gray-900">{active === "friends" ? "Friends" : active === "close" ? "Close" : "Work"} access</div>
            <div className="text-xs text-gray-400">{headerCount} total</div>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading…</div>
          ) : !data?.ok ? (
            <div className="p-4">
              <div className="text-sm font-bold text-gray-900">Could not load</div>
              <div className="text-xs text-gray-500 mt-1">{data?.error || "unknown_error"}</div>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 inline-flex px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
              >
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-sm font-extrabold text-gray-900">No one here yet</div>
              <div className="text-xs text-gray-500 mt-1">When you Side people, they’ll appear in this list.</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map((it) => {
                const letter = (it.displayName || it.handle || "?").trim().slice(0, 1).toUpperCase();
                const avatar = (it.avatarImage || "").trim();
                const busy = busyId === it.handle;

                return (
                  <div key={it.handle} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                        {avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-sm font-black text-gray-600">{letter}</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-gray-900 truncate">{(it.displayName || "").trim() || it.handle}</div>
                        <div className="text-xs text-gray-500 truncate">{it.handle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {active === "close" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void downgradeToFriends(it)}
                          className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
                        >
                          Move to Friends
                        </button>
                      ) : null}

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeAccess(it)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-extrabold border disabled:opacity-60",
                          active === "close" || active === "work" ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-gray-200 bg-white hover:bg-gray-50"
                        )}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 text-[11px] text-gray-400">Tip: This page is the fast audit. Profile pages show the same relationship, but with context.</div>
      </div>
    </div>
  );
}
