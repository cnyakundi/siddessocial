"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, MoreHorizontal, PenSquare, Shield, Users, X, Check } from "lucide-react";

import { useSide } from "@/src/components/SideProvider";

type Broadcast = {
  id: string;
  name: string;
  handle: string;
  category?: string;
  desc?: string;
  subscriber_count?: number;
  isSubscribed?: boolean;
  pinned_rules?: string | null;
};

type FeedPost = {
  id: string;
  author?: string;
  handle?: string;
  time?: string;
  content: string;
  kind?: string;
  broadcast?: { id: string; name: string; handle: string } | null;
};

type WriterItem = { viewerId: string; role: string; name?: string; handle?: string };
type NotifyMode = "off" | "highlights" | "all";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function NotifySheet({
  open,
  onClose,
  mode,
  muted,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  mode: NotifyMode;
  muted: boolean;
  onSave: (next: { mode: NotifyMode; muted: boolean }) => void;
  saving: boolean;
}) {
  const [m, setM] = useState<NotifyMode>(mode);
  const [mu, setMu] = useState<boolean>(muted);

  useEffect(() => {
    if (open) {
      setM(mode);
      setMu(muted);
    }
  }, [open, mode, muted]);

  if (!open) return null;

  const item = (id: NotifyMode, label: string, desc: string) => {
    const active = m === id;
    return (
      <button
        type="button"
        onClick={() => setM(id)}
        className={cn(
          "w-full text-left p-3 rounded-xl border flex items-center justify-between",
          active ? "border-gray-900 bg-gray-50" : "border-gray-100 hover:bg-gray-50"
        )}
      >
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-gray-900">{label}</div>
          <div className="text-xs text-gray-500">{desc}</div>
        </div>
        {active ? <Check size={18} className="text-gray-900" /> : null}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center md:items-center">
      <button className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-label="Close" />

      <div className="relative w-full max-w-xl bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-sm font-extrabold text-gray-900">Notifications</div>
          <button className="p-2 rounded-full hover:bg-gray-100" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {item("off", "Off", "No alerts from this broadcast.")}
          {item("highlights", "Highlights", "Only important updates (recommended).")}
          {item("all", "All", "Every update (may be noisy).")}

          <div className="mt-4 p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Mute</div>
              <div className="text-xs text-gray-500">Stay followed, but hide updates from tray.</div>
            </div>
            <button
              type="button"
              onClick={() => setMu((v) => !v)}
              className={cn(
                "px-3 py-2 rounded-full text-xs font-extrabold border",
                mu ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
              )}
            >
              {mu ? "Muted" : "On"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onSave({ mode: m, muted: mu })}
            disabled={saving}
            className="mt-2 w-full rounded-full bg-blue-600 text-white text-sm font-extrabold py-3 hover:opacity-95 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <div className="text-[11px] text-gray-400">Siddes uses calm dots, not addictive counters.</div>
        </div>
      </div>
    </div>
  );
}

export default function BroadcastHubPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params?.id;

  const { side, setSide } = useSide();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [requestedPublic, setRequestedPublic] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (side === "public") return;
    if (requestedPublic) return;
    setRequestedPublic(true);
    setSide("public", { afterCancel: () => router.replace("/siddes-feed") });
  }, [hydrated, side, requestedPublic, setSide, router]);

  const [tab, setTab] = useState<"posts" | "about">("posts");
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  const [team, setTeam] = useState<WriterItem[] | null>(null);
  const [canWrite, setCanWrite] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newWriterId, setNewWriterId] = useState("");
  const [teamErr, setTeamErr] = useState<string | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMode, setNotifyMode] = useState<NotifyMode>("highlights");
  const [muted, setMuted] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => broadcast?.name || "Broadcast", [broadcast]);

  useEffect(() => {
    if (!hydrated || side !== "public") return;
    let mounted = true;

    fetch(`/api/broadcasts/${id}/seen`, { method: "POST" }).catch(() => {});

    fetch(`/api/broadcasts/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        setBroadcast(d?.item || null);
      })
      .catch(() => {
        if (!mounted) return;
        setBroadcast(null);
      });

    fetch(`/api/broadcasts/${id}/posts`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        setPosts(Array.isArray(d?.items) ? d.items : []);
      })
      .catch(() => {
        if (!mounted) return;
        setPosts([]);
      });

    fetch(`/api/broadcasts/${id}/writers`, { cache: "no-store" })
      .then(async (r) => {
        const data = await safeJson(r);
        if (!mounted) return;

        if (r.ok) {
          const items = Array.isArray(data?.items) ? data.items : [];
          setCanWrite(true);
          setTeam(items);
        } else {
          setCanWrite(false);
          setTeam(null);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setCanWrite(false);
        setTeam(null);
      });

    return () => {
      mounted = false;
    };
  }, [id, hydrated, side]);

  async function toggleFollow() {
    if (!broadcast) return;
    setBusy(true);
    setErr(null);
    try {
      const isSub = !!broadcast.isSubscribed;
      const url = `/api/broadcasts/${id}/${isSub ? "unfollow" : "follow"}`;
      const res = await fetch(url, { method: "POST" });
      const data = await safeJson(res);
      if (!res.ok) {
        setErr(String(data?.error || "Failed"));
      } else {
        setBroadcast({ ...broadcast, isSubscribed: !isSub });
      }
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function saveNotify(next: { mode: NotifyMode; muted: boolean }) {
    setNotifyBusy(true);
    try {
      const res = await fetch(`/api/broadcasts/${id}/notify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: next.mode, muted: next.muted }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setErr(String(data?.error || "Failed"));
      } else {
        setNotifyMode(next.mode);
        setMuted(next.muted);
        setNotifyOpen(false);
      }
    } catch {
      setErr("Network error");
    } finally {
      setNotifyBusy(false);
    }
  }

  async function addWriter() {
    setTeamErr(null);
    const vid = newWriterId.trim();
    if (!vid) return setTeamErr("viewerId required (e.g. me_2).");
    setTeamBusy(true);
    try {
      const res = await fetch(`/api/broadcasts/${id}/writers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewerId: vid }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setTeamErr(String(data?.error || "Failed"));
      } else {
        setTeam(Array.isArray(data?.items) ? data.items : []);
        setNewWriterId("");
        setAddOpen(false);
      }
    } catch {
      setTeamErr("Network error");
    } finally {
      setTeamBusy(false);
    }
  }

  async function removeWriter(viewerId: string) {
    setTeamErr(null);
    setTeamBusy(true);
    try {
      const res = await fetch(`/api/broadcasts/${id}/writers`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewerId }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setTeamErr(String(data?.error || "Failed"));
      } else {
        setTeam(Array.isArray(data?.items) ? data.items : []);
      }
    } catch {
      setTeamErr("Network error");
    } finally {
      setTeamBusy(false);
    }
  }

  if (hydrated && side !== "public") {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="max-w-2xl mx-auto bg-white md:border-x border-gray-100 min-h-[calc(100vh-56px)]">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-50 rounded-full text-gray-700" aria-label="Back">
          <ArrowLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-gray-900 truncate">{title}</div>
          <div className="text-[11px] text-gray-500 truncate">{broadcast?.handle || ""}</div>
        </div>

        {canWrite ? (
          <Link href={`/siddes-broadcasts/${id}/compose`} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-extrabold hover:opacity-95">
            <PenSquare size={16} />
            New update
          </Link>
        ) : null}

        <button className="p-2 -mr-2 hover:bg-gray-50 rounded-full text-gray-600" aria-label="More">
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="px-5 py-6 border-b border-gray-50">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-2xl font-black text-gray-900">{broadcast?.name || "..."}</div>
            <div className="text-sm text-gray-500 font-mono mt-1">{broadcast?.handle || ""}</div>
            {broadcast?.desc ? <div className="text-sm text-gray-700 mt-3 leading-relaxed">{broadcast.desc}</div> : null}

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-extrabold">Public</span>
              {broadcast?.category ? <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-bold">{broadcast.category}</span> : null}
              {typeof broadcast?.subscriber_count === "number" ? (
                <span className="text-gray-400">{broadcast.subscriber_count.toLocaleString()} followers</span>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 flex flex-col gap-2">
            <button
              onClick={toggleFollow}
              disabled={busy || !broadcast}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-extrabold border",
                broadcast?.isSubscribed ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50" : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700",
                busy ? "opacity-60" : ""
              )}
            >
              {broadcast?.isSubscribed ? "Following" : "Follow"}
            </button>
            <button onClick={() => setNotifyOpen(true)} className="px-3 py-2.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50" title="Notifications">
              <Bell size={18} />
            </button>
          </div>
        </div>

        {err ? <div className="mt-4 text-sm font-bold text-rose-600">{err}</div> : null}

        <div className="mt-6 flex border-b border-gray-100">
          <button onClick={() => setTab("posts")} className={cn("flex-1 py-3 text-sm font-extrabold border-b-2 transition-colors", tab === "posts" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-400 hover:text-gray-600")}>
            Posts
          </button>
          <button onClick={() => setTab("about")} className={cn("flex-1 py-3 text-sm font-extrabold border-b-2 transition-colors", tab === "about" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-400 hover:text-gray-600")}>
            About
          </button>
        </div>
      </div>

      {tab === "posts" ? (
        <div className="bg-gray-50">
          {broadcast?.pinned_rules ? (
            <div className="bg-white p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2">
                <Shield size={12} /> Pinned rules
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{broadcast.pinned_rules}</div>
            </div>
          ) : null}

          {posts === null ? (
            <div className="p-10 text-center text-sm text-gray-500">Loading...</div>
          ) : posts.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No updates yet.</div>
          ) : (
            <div>
              {posts.map((p) => (
                <div key={p.id} className="bg-white border-b border-gray-50 p-5">
                  <div className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{p.content}</div>
                  <div className="mt-3 text-xs text-gray-400 flex items-center justify-between">
                    <span>{p.time || "now"}</span>
                    <span>{p.author ? `by ${p.author}` : ""}</span>
                  </div>
                </div>
              ))}
              <div className="p-10 text-center text-xs text-gray-400">End of updates</div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 bg-gray-50">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="text-sm font-extrabold text-gray-900">About</div>
            <div className="text-sm text-gray-600 mt-2 leading-relaxed">{broadcast?.desc || "-"}</div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-gray-400">
                  <Users size={14} /> Team
                </div>

                {canWrite ? (
                  <button type="button" onClick={() => setAddOpen(true)} className="text-xs font-extrabold text-blue-600 hover:underline">
                    Manage
                  </button>
                ) : null}
              </div>

              {!canWrite ? (
                <div className="mt-3 text-sm text-gray-500">Team is private. Only owners/writers can view it.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {team && team.length ? (
                    team.map((m) => (
                      <div key={m.name || m.handle || m.viewerId} className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">{m.viewerId}</div>
                          <div className="text-xs text-gray-500">{m.role}</div>
                        </div>

                        <button type="button" onClick={() => removeWriter(m.viewerId)} disabled={teamBusy || m.role === "owner"} className="text-xs font-extrabold text-gray-500 hover:text-gray-900 disabled:opacity-50">
                          Remove
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 mt-2">No team members found.</div>
                  )}

                  {teamErr ? <div className="text-sm font-bold text-rose-600">{teamErr}</div> : null}

                  <div className="text-[11px] text-gray-400">Notifications: {notifyMode}{muted ? " (muted)" : ""}.</div>
                </div>
              )}
            </div>
          </div>

          {addOpen ? (
            <>
              <button className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm" onClick={() => setAddOpen(false)} aria-label="Close" />
              <div className="fixed inset-x-0 bottom-0 z-[210] max-w-2xl mx-auto bg-white border border-gray-100 rounded-t-3xl p-5 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-gray-900">Add writer</div>
                  <button className="p-2 rounded-full hover:bg-gray-100" onClick={() => setAddOpen(false)} aria-label="Close">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-extrabold uppercase tracking-widest text-gray-500">Account</label>
                  <input value={newWriterId} onChange={(e) => setNewWriterId(e.target.value)} placeholder="me_2" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-300" />
                  <button onClick={addWriter} disabled={teamBusy} className="mt-4 w-full rounded-full bg-gray-900 text-white text-sm font-extrabold py-3 hover:opacity-95 disabled:opacity-60">
                    {teamBusy ? "Saving..." : "Add writer"}
                  </button>
                  {teamErr ? <div className="mt-3 text-sm font-bold text-rose-600">{teamErr}</div> : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      <NotifySheet open={notifyOpen} onClose={() => setNotifyOpen(false)} mode={notifyMode} muted={muted} onSave={saveNotify} saving={notifyBusy} />
    </div>
  );
}
