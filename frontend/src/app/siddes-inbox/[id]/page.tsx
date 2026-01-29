"use client";
export const dynamic = "force-dynamic";

import { type SideId, SIDES, SIDE_THEMES } from "@/src/lib/sides";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Send, X } from "lucide-react";
import { InboxBanner } from "@/src/components/InboxBanner";
import { InboxStubDebugPanel } from "@/src/components/InboxStubDebugPanel";
import { toast } from "@/src/lib/toastBus";
import { fetchMe } from "@/src/lib/authMe";
import { MentionPicker } from "@/src/components/MentionPicker";
import { useSide } from "@/src/components/SideProvider";

import { getInboxProvider } from "@/src/lib/inboxProvider";
import { useInboxStubViewer } from "@/src/lib/useInboxStubViewer";
import {
  appendMessage,
  ensureThreadLockedSide,
  loadThread,
  loadThreadMeta,
  saveThread,
  saveThreadMeta,
  setThreadLockedSide,
  type ThreadMessage,
} from "@/src/lib/threadStore";
import { clearThreadUnread } from "@/src/lib/inboxState";
import { loadRecentMoveSides, pushRecentMoveSide } from "@/src/lib/inboxMoveRecents";
import type { MentionCandidate } from "@/src/lib/mentions";
function hashSeed(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

function avatarOverlayStyle(seed?: string | null): React.CSSProperties | null {
  const raw = String(seed || "").trim();
  if (!raw) return null;

  const h = hashSeed(raw);
  const variant = h % 6;
  const ox = h % 7;
  const oy = (h >>> 3) % 7;
  const pos = `${ox}px ${oy}px`;

  if (variant === 0) {
    return {
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0, rgba(255,255,255,0.45) 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
      backgroundPosition: pos,
    };
  }
  if (variant === 1) {
    return {
      backgroundImage:
        "repeating-linear-gradient(-45deg, rgba(0,0,0,0.08) 0, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 4px)",
      backgroundPosition: pos,
    };
  }
  if (variant === 2) {
    return {
      backgroundImage: "radial-gradient(rgba(0,0,0,0.10) 1px, transparent 1px)",
      backgroundSize: "6px 6px",
      backgroundPosition: pos,
    };
  }
  if (variant === 3) {
    return {
      backgroundImage:
        "linear-gradient(rgba(0,0,0,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.10) 1px, transparent 1px)",
      backgroundSize: "7px 7px",
      backgroundPosition: pos,
    };
  }
  if (variant === 4) {
    return {
      backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)",
    };
  }

  return {
    backgroundImage:
      "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%), radial-gradient(circle at 70% 70%, rgba(0,0,0,0.08), rgba(0,0,0,0) 60%)",
  };
}

function AvatarBubble({
  initials,
  sideId,
  seed,
}: {
  initials: string;
  sideId?: SideId;
  seed?: string | null;
}) {
  const v = (initials || "??").slice(0, 2).toUpperCase();
  const theme = sideId ? SIDE_THEMES[sideId] : null;
  const overlayStyle = avatarOverlayStyle(seed);

  return (
    <div
      className={cn(
        "relative w-8 h-8 rounded-full border flex items-center justify-center text-[12px] font-bold select-none overflow-hidden",
        theme ? theme.lightBg : "bg-gray-200",
        theme ? theme.border : "border-gray-200",
        theme ? theme.text : "text-gray-800"
      )}
      aria-label="Avatar"
      title={sideId ? `Locked Side: ${SIDES[sideId].label}` : "Avatar"}
    >
      {overlayStyle ? (
        <div aria-hidden className="absolute inset-0 opacity-50 pointer-events-none" style={overlayStyle} />
      ) : null}
      <span className="relative z-10">{v}</span>
    </div>
  );
}


function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function WarningBar({
  lockedSide,
  currentSide,
  onSwitchBack,
  onMove,
}: {
  lockedSide: SideId;
  currentSide: SideId;
  onSwitchBack: () => void;
  onMove: () => void;
}) {
  return (
    <div data-testid="side-mismatch-warning" className="mt-3 p-3 rounded-2xl border border-amber-200 bg-amber-50 flex items-start gap-3">
      <AlertTriangle size={18} className="text-amber-700 mt-0.5" />
      <div className="flex-1">
        <div className="text-sm font-bold text-amber-900">Side changed</div>
        <div className="text-xs text-amber-800 mt-1">
          This thread is locked to <b>{SIDES[lockedSide].label}</b>, but you’re now in{" "}
          <b>{SIDES[currentSide].label}</b>.
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <button
            type="button"
            className="px-3 py-1.5 rounded-full bg-amber-800 text-white text-xs font-bold hover:opacity-90"
            onClick={onSwitchBack}
          >
            Switch back
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100"
            onClick={onMove}
          >
            Move thread to this Side
          </button>
        </div>
      </div>
    </div>
  );
}

function MoveConfirmBar({
  fromSide,
  toSide,
  onCancel,
  onConfirm,
}: {
  fromSide: SideId;
  toSide: SideId;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div data-testid="move-confirm" className="mt-2 p-3 rounded-2xl border border-rose-200 bg-rose-50 flex items-start gap-3">
      <AlertTriangle size={18} className="text-rose-700 mt-0.5" />
      <div className="flex-1">
        <div className="text-sm font-bold text-rose-900">Confirm move</div>
        <div className="text-xs text-rose-800 mt-1">
          You’re moving this thread from <b>{SIDES[fromSide].label}</b> (private) to{" "}
          <b>{SIDES[toSide].label}</b> (less private). Future messages will be sent under{" "}
          <b>{SIDES[toSide].label}</b>.
        </div>
        <div className="text-[11px] text-rose-800 mt-2">
          You can move it back anytime. Past messages aren’t changed.
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-full bg-white border border-rose-200 text-rose-900 text-xs font-bold hover:bg-rose-100"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-full bg-rose-700 text-white text-xs font-bold hover:bg-rose-800"
            onClick={onConfirm}
          >
            Move anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextRiskStrip({ lockedSide }: { lockedSide: SideId }) {
  const isPrivate = SIDES[lockedSide]?.isPrivate;
  if (!isPrivate) return null;

  return (
    <div data-testid="thread-context-risk-strip" className="mt-3 p-3 rounded-2xl border border-rose-200 bg-rose-50 flex items-start gap-3">
      <AlertTriangle size={18} className="text-rose-700 mt-0.5" />
      <div className="flex-1">
        <div className="text-sm font-bold text-rose-900">Context Risk</div>
        <div className="text-xs text-rose-800 mt-1">
          This thread is locked to <b>{SIDES[lockedSide].label}</b> (private). Double-check your Side before replying.
        </div>
      </div>
    </div>
  );
}

function SidePickerSheet({
  open,
  lockedSide,
  activeSide,
  onClose,
  onPick,
  recentSides,
}: {
  open: boolean;
  lockedSide: SideId;
  activeSide: SideId;
  onClose: () => void;
  onPick: (to: SideId) => void;
  recentSides: SideId[];
}) {
  if (!open) return null;

  const suggested = ([activeSide, ...(recentSides ?? [])] as SideId[])
    .filter((sid, idx, arr) => arr.indexOf(sid) === idx)
    .filter((sid) => sid !== lockedSide)
    .slice(0, 4);

  return (
    <div data-testid="move-sheet" className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close move sheet" />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl border-t border-gray-200">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-gray-900">Move thread</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Locked: <span className="font-bold">{SIDES[lockedSide].label}</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Choose where <span className="font-bold">future</span> messages are sent. You can change it later.
            </div>
          </div>
          <button type="button" className="p-2 rounded-full hover:bg-gray-100" onClick={onClose} aria-label="Close" title="Close">
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <div className="px-4 pb-5">
          <div data-testid="move-suggested" className="text-xs font-bold text-gray-600 mb-2">
            Suggested
          </div>
          <div className="text-[11px] text-gray-500 mb-2">Smart default: your current Side + recent targets.</div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button
              type="button"
              onClick={() => onPick(activeSide)}
              className="flex-shrink-0 px-3 py-2 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition"
              title={`Move to ${SIDES[activeSide].label}`}
              aria-label={`Move to ${SIDES[activeSide].label}`}
            >
              <div className="text-xs font-bold text-gray-900">Move to {SIDES[activeSide].label}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Current Side</div>
            </button>

            {suggested
              .filter((sid) => sid !== activeSide)
              .map((sid) => (
                <button
                  key={sid}
                  type="button"
                  onClick={() => onPick(sid)}
                  className="flex-shrink-0 px-3 py-2 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition"
                  title={`Move to ${SIDES[sid].label}`}
                  aria-label={`Move to ${SIDES[sid].label}`}
                >
                  <div className="text-xs font-bold text-gray-900">{SIDES[sid].label}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Recent</div>
                </button>
              ))}
          </div>

          <div data-testid="move-all-sides" className="mt-3 text-xs font-bold text-gray-600 mb-2">
            All Sides{/* Pick a Side */}
          </div>
          <div className="text-[11px] text-gray-500 mb-2">This sets the thread’s sending Side.</div>

          <div className="space-y-2">
            {(Object.keys(SIDES) as SideId[]).map((sid) => {
              const isLocked = sid === lockedSide;
              const isActive = sid === activeSide;
              const isPrivate = SIDES[sid].isPrivate;

              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => onPick(sid)}
                  className={cn(
                    "w-full text-left px-3 py-3 rounded-2xl border flex items-center justify-between hover:bg-gray-50 transition",
                    isLocked ? "border-gray-900/20 bg-gray-50" : "border-gray-200"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-gray-900">{SIDES[sid].label}</div>
                      {isPrivate ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                          Private
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                          Standard
                        </span>
                      )}
                      {isLocked ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-700">
                          Locked
                        </span>
                      ) : null}
                      {isActive ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-700">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{SIDES[sid].privacyHint}</div>
                  </div>

                  {isLocked ? (
                    <CheckCircle2 size={18} className="text-gray-900/70 flex-shrink-0" />
                  ) : (
                    <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 text-[11px] text-gray-400">
            Tip: suggested targets include your current Side + recently used Sides.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SiddesThreadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SiddesThreadPageInner />
    </Suspense>
  );
}

function SiddesThreadPageInner() {
  const params = useParams();
  const id = (params?.id as string) || "t1";

  const { side, setSide } = useSide();
  const theme = SIDE_THEMES[side];
  const provider = useMemo(() => getInboxProvider(), []);

  const sp = useSearchParams();
  const debug = sp.get("debug") === "1";

  const [viewerInput, setViewerInput] = useInboxStubViewer();
  const [retryingMe, setRetryingMe] = useState(false);

  const retryAsMe = async () => {
    if (retryingMe) return;
    setRetryingMe(true);
    try {
      const me = await fetchMe();
      const vid = String(me?.viewerId || "").trim();
      if (me?.authenticated && vid) {
        setViewerInput(vid);
        toast?.info?.("Retrying as your session user…");
      } else {
        toast?.error?.("Not signed in. Please sign in, then retry.");
      }
    } catch {
      toast?.error?.("Retry failed. Please sign in and try again.");
    } finally {
      setRetryingMe(false);
    }
  };

  const clearViewer = () => {
    try {
      setViewerInput("");
      toast?.success?.("Cleared viewer override.");
    } catch {}
  };

  const viewer = (viewerInput || "").trim() || undefined;
  const MSG_PAGE = 30;

  const [title, setTitle] = useState("Thread");
  const [participantDisplayName, setParticipantDisplayName] = useState<string | null>(null);
  const [participantInitials, setParticipantInitials] = useState("??");
  const [participantSeed, setParticipantSeed] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");

  const [msgHasMore, setMsgHasMore] = useState(false);
  const [msgCursor, setMsgCursor] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const [restricted, setRestricted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  // sd_717b: mention suggestions are Side-scoped (No Leaks)
  const [lockedSide, setLockedSide] = useState<SideId>("friends");

  // sd_181o: DB-backed mention candidates (no [])
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [mentionCandidatesLoading, setMentionCandidatesLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    const ac = new AbortController();

    if (!mentionOpen) {
      return () => {
        alive = false;
        try { ac.abort(); } catch {}
      };
    }

    setMentionCandidatesLoading(true);

    const s = String(lockedSide || "").trim().toLowerCase();
    const isPrivateSide = s === "friends" || s === "close" || s === "work";

    const finish = (items: MentionCandidate[]) => {
      if (!alive) return;

      // De-dupe by handle, keep stable order.
      const seen = new Set<string>();
      const uniq = items.filter((m) => {
        const h = String((m as any)?.handle || "").trim();
        if (!h) return false;
        if (seen.has(h)) return false;
        seen.add(h);
        return true;
      });

      setMentionCandidates(uniq.slice(0, 80));
    };

    (async () => {
      try {
        if (isPrivateSide) {
          const r = await fetch("/api/siders", { cache: "no-store", signal: ac.signal });
          const j = await r.json().catch(() => ({} as any));
          const sides = (j as any)?.sides || {};

          const friendsArr = Array.isArray((sides as any)?.friends) ? (sides as any).friends : [];
          const closeArr = Array.isArray((sides as any)?.close) ? (sides as any).close : [];
          const workArr = Array.isArray((sides as any)?.work) ? (sides as any).work : [];

          const bucket =
            s === "friends"
              ? ([] as any[]).concat(friendsArr, closeArr) // close can view friends posts
              : s === "close"
                ? closeArr
                : s === "work"
                  ? workArr
                  : [];

          const mapped = (bucket as any[])
            .map((x: any) => {
              const name = String(x?.displayName || x?.handle || "").trim();
              let handle = String(x?.handle || "").trim();
              if (!handle && name) handle = name.startsWith("@") ? name : `@${name}`;
              handle = String(handle || "").trim();
              if (!handle) return null;
              if (!handle.startsWith("@")) handle = `@${handle.replace(/^@+/, "")}`;
              return { name: name || handle, handle } as MentionCandidate;
            })
            .filter(Boolean) as MentionCandidate[];

          finish(mapped);
          return;
        }

        // Public fallback: suggestions are viewer-scoped (no global directory)
        const r = await fetch("/api/contacts/suggestions", { cache: "no-store", signal: ac.signal });
        const j = await r.json().catch(() => ({} as any));
        const items = Array.isArray((j as any)?.items) ? (j as any).items : [];
        const mapped = items
          .map((x: any) => {
            const name = String(x?.name || x?.handle || "").trim();
            let handle = String(x?.handle || "").trim();
            if (!handle && name) handle = name.startsWith("@") ? name : `@${name}`;
            handle = String(handle || "").trim();
            if (!handle) return null;
            if (!handle.startsWith("@")) handle = `@${handle.replace(/^@+/, "")}`;
            return { name: name || handle, handle } as MentionCandidate;
          })
          .filter(Boolean) as MentionCandidate[];

        finish(mapped);
      } catch {
        if (!alive) return;
        setMentionCandidates([]);
      } finally {
        if (!alive) return;
        setMentionCandidatesLoading(false);
      }
    })();

    return () => {
      alive = false;
      try { ac.abort(); } catch {}
    };
  }, [mentionOpen, lockedSide]);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const [moveConfirmTo, setMoveConfirmTo] = useState<SideId | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [recentMoveSides, setRecentMoveSides] = useState<SideId[]>([]);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();

    setRestricted(false);
    setError(null);

    (async () => {
      try {
        const view = await provider.getThread(id, { viewer, limit: MSG_PAGE, signal: ac.signal });
        if (!alive) return;

        if (!view?.thread) {
          setRestricted(true);
          const meta = loadThreadMeta(id);
          if (meta?.lockedSide) setLockedSide(meta.lockedSide);
          setMsgs([]);
          setParticipantDisplayName(null);
          setParticipantSeed(null);
          return;
        }

        const t = (view?.thread as any) || {};
        setTitle(t?.title ?? "Thread");
        setParticipantDisplayName(String(t?.participant?.displayName || "").trim() || null);
        setParticipantInitials(String(t?.participant?.initials || (t?.title || "??").slice(0, 2)));
        setParticipantSeed(String(t?.participant?.avatarSeed || t?.id || id || "").trim() || null);

        const loaded = (view?.messages ?? []) as ThreadMessage[];
        setMsgs(loaded);
        saveThread(id, loaded);

        setMsgHasMore(Boolean(view?.messagesHasMore));
        setMsgCursor((view?.messagesNextCursor ?? null) as string | null);

        const locked = (view?.meta?.lockedSide ?? t?.lockedSide ?? "friends") as SideId;
        setLockedSide(locked);
        if (view?.meta) saveThreadMeta(id, view.meta);

        ensureThreadLockedSide(id, locked);

        clearThreadUnread(id);
        setRecentMoveSides(loadRecentMoveSides());
      } catch {
        setError("Failed to load thread.");
        if (toast?.error) toast.error("Thread failed to load");

        setTitle("Thread");
        setParticipantDisplayName(null);
        setParticipantInitials("??");
        setParticipantSeed(null);
        const local = loadThread(id);
        setMsgs(local);
        saveThread(id, local);

        const meta = ensureThreadLockedSide(id, side);
        setLockedSide(meta.lockedSide);

        setMsgHasMore(false);
        setMsgCursor(null);

        clearThreadUnread(id);
        setRecentMoveSides(loadRecentMoveSides());
      }
    })();

    return () => {
      alive = false;
      try { ac.abort(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, provider, viewer]);

  // sd_790_inbox_live_poll: lightweight live refresh so inbound DMs appear while the thread is open.
  // This is polling (no websockets yet). We bypass the 30s session cache to keep it truly fresh.
  useEffect(() => {
    if (restricted) return;
    if (typeof window === "undefined") return;

    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;

        const view = await provider.getThread(id, { viewer, limit: MSG_PAGE, bypassCache: true });
        if (!view?.thread) return;

        const incoming = (view?.messages ?? []) as ThreadMessage[];
        if (!incoming.length) return;

        setMsgs((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          let added = false;

          for (const m of incoming) {
            if (!m || !(m as any).id) continue;
            const mid = String((m as any).id);
            if (!mid || seen.has(mid)) continue;
            merged.push(m);
            seen.add(mid);
            added = true;
          }

          if (!added) return prev;
          merged.sort((a, b) => a.ts - b.ts);
          try {
            saveThread(id, merged);
          } catch {}
          return merged;
        });

        // Keep local unread cleared while open.
        try {
          clearThreadUnread(id);
        } catch {}
      } catch {
        // ignore
      }
    };

    // First tick + then poll.
    void tick();
    const t = window.setInterval(() => {
      void tick();
    }, 2500);

    const onWake = () => {
      void tick();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      stopped = true;
      try {
        window.clearInterval(t);
      } catch {}
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [id, provider, viewer, restricted]);


  const loadEarlier = async () => {
    if (provider.name !== "backend_stub") return;
    if (!msgHasMore || !msgCursor) return;
    if (loadingEarlier) return;

    setLoadingEarlier(true);
    try {
      const view = await provider.getThread(id, { viewer, limit: MSG_PAGE, cursor: msgCursor });
      const older = (view?.messages ?? []) as ThreadMessage[];

      setMsgs((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...older.filter((m) => !seen.has(m.id)), ...prev];
        merged.sort((a, b) => a.ts - b.ts);
        saveThread(id, merged);
        return merged;
      });

      setMsgHasMore(Boolean(view?.messagesHasMore));
      setMsgCursor((view?.messagesNextCursor ?? null) as string | null);
    } catch {
      setError("Failed to load earlier messages.");
      if (toast?.error) toast.error("Failed to load earlier");
    } finally {
      setLoadingEarlier(false);
    }
  };

  const sideMismatch = lockedSide !== side;

  const isPrivacyDowngrade = (from: SideId, to: SideId) => {
    return SIDES[from]?.isPrivate && !SIDES[to]?.isPrivate;
  };

  const openMovePicker = () => {
    setMoveConfirmTo(null);
    setRecentMoveSides(loadRecentMoveSides());
    setMovePickerOpen(true);
  };

  const requestMoveTo = async (to: SideId) => {
    if (to === lockedSide) {
      setMoveConfirmTo(null);
      setMovePickerOpen(false);
      return;
    }

    if (isPrivacyDowngrade(lockedSide, to)) {
      setMoveConfirmTo(to);
      setMovePickerOpen(false);
      return;
    }

    if (!isOnline) {
      const meta = setThreadLockedSide(id, to);
      setLockedSide(meta.lockedSide);
      setRecentMoveSides(pushRecentMoveSide(to));
      setMoveConfirmTo(null);
      setMovePickerOpen(false);
      return;
    }

    try {
      const meta = await provider.setLockedSide(id, to, { viewer });
      setLockedSide(meta.lockedSide);
      saveThreadMeta(id, meta);
      setRecentMoveSides(pushRecentMoveSide(to));
    } catch {
      setError("Failed to move thread.");
      if (toast?.error) toast.error("Failed to move thread");
    } finally {
      setMoveConfirmTo(null);
      setMovePickerOpen(false);
    }
  };

  const confirmMove = async () => {
    if (!moveConfirmTo) return;

    if (!isOnline) {
      const meta = setThreadLockedSide(id, moveConfirmTo);
      setLockedSide(meta.lockedSide);
      setRecentMoveSides(pushRecentMoveSide(moveConfirmTo));
      setMoveConfirmTo(null);
      setMovePickerOpen(false);
      return;
    }

    try {
      const meta = await provider.setLockedSide(id, moveConfirmTo, { viewer });
      setLockedSide(meta.lockedSide);
      saveThreadMeta(id, meta);
      setRecentMoveSides(pushRecentMoveSide(moveConfirmTo));
    } catch {
      setError("Failed to move thread.");
      if (toast?.error) toast.error("Failed to move thread");
    } finally {
      setMoveConfirmTo(null);
      setMovePickerOpen(false);
    }
  };

  useEffect(() => {
    if (moveConfirmTo && moveConfirmTo !== side) {
      setMoveConfirmTo(null);
      setMovePickerOpen(false);
    }
  }, [moveConfirmTo, side]);

  useEffect(() => {
    const idx = text.lastIndexOf("@");
    if (idx === -1) {
      setMentionOpen(false);
      setMentionQuery("");
      return;
    }
    const after = text.slice(idx + 1);
    if (after.includes(" ")) {
      setMentionOpen(false);
      setMentionQuery("");
      return;
    }
    setMentionOpen(true);
    setMentionQuery(after);
  }, [text]);

  const insertMention = (handle: string) => {
    const idx = text.lastIndexOf("@");
    if (idx === -1) return;
    const before = text.slice(0, idx);
    const next = `${before}${handle} `;
    setText(next);
    setMentionOpen(false);
    setMentionQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const send = async () => {
    const v = text.trim();
    if (!v) return;

    if (restricted) {
      if (toast?.warning) toast.warning("Thread unavailable");
      return;
    }

    if (!isOnline) {
      const item = appendMessage(id, { from: "me", text: v, queued: true, side: lockedSide });
      const next = [...msgs, item];
      setMsgs(next);
      saveThread(id, next);
      setText("");
      setMentionOpen(false);
      setMentionQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    try {
      const item = await provider.sendMessage(id, v, "me", { viewer });
      if (!(item as any)?.id) {
        setRestricted(true);
        if (toast?.warning) toast.warning("Thread became restricted");
        return;
      }
      const next = [...msgs, item];
      setMsgs(next);
      saveThread(id, next);
    } catch {
      setError("Failed to send message.");
      if (toast?.error) toast.error("Failed to send");

      const item = appendMessage(id, { from: "me", text: v, queued: false, side: lockedSide });
      const next = [...msgs, item];
      setMsgs(next);
      saveThread(id, next);
    } finally {
      setText("");
      setMentionOpen(false);
      setMentionQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {debug ? <InboxStubDebugPanel viewer={viewerInput} onViewer={setViewerInput} /> : null}
      <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/siddes-inbox" className="text-sm font-bold text-gray-700 hover:underline">
          ← Inbox
        </Link>
        <div className={cn("text-xs font-bold px-3 py-1 rounded-full border", theme.lightBg, theme.border, theme.text)}>
          {SIDES[side].label}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-28">
        {restricted ? (
          <InboxBanner tone="warn" title="Restricted thread">
            <div data-testid="restricted-thread-banner" className="space-y-2">
              <div>This thread is unavailable (restricted or not found).</div>

              <div data-testid="restricted-thread-actions" className="flex gap-2 flex-wrap">
                                <button
                  type="button"
                  data-testid="restricted-thread-retry-me"
                  onClick={retryAsMe}
                  disabled={retryingMe}
                  className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100 disabled:opacity-60"
                >
                  {retryingMe ? "Retrying…" : "Restricted — retry as me"}
                </button>

                <button
                  type="button"
                  data-testid="restricted-thread-clear-viewer"
                  onClick={clearViewer}
                  className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-900 text-xs font-bold hover:bg-gray-50"
                >
                  Clear viewer
                </button>

<Link
                  data-testid="restricted-thread-back-inbox"
                  href="/siddes-inbox"
                  className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100"
                >
                  Back to Inbox
                </Link>
              </div>
            </div>
          </InboxBanner>
        ) : null}

        {error ? (
          <InboxBanner tone="danger" title="Thread error">
            {error}
          </InboxBanner>
        ) : null}

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
              <AvatarBubble initials={participantInitials} sideId={lockedSide} seed={participantSeed} />
              <div className="text-lg font-bold text-gray-900">{participantDisplayName || title}</div>
            </div>
              <div className="text-sm text-gray-500 mt-1">Messages</div>
            </div>
            <div className="text-xs font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
              Locked: {SIDES[lockedSide].label}
            </div>
          </div>

          <ContextRiskStrip lockedSide={lockedSide} />

          {provider.name === "backend_stub" && msgHasMore ? (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                data-testid="thread-load-earlier"
                onClick={() => void loadEarlier()}
                disabled={loadingEarlier}
                className={cn(
                  "px-4 py-2 rounded-full border text-sm font-bold",
                  loadingEarlier ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                )}
              >
                {loadingEarlier ? "Loading…" : "Load earlier"}
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "px-3 py-2 rounded-2xl text-sm max-w-[80%]",
                  m.from === "me" ? "bg-gray-900 text-white ml-auto" : "bg-gray-100 text-gray-900"
                )}
                title={m.queued ? "Queued (offline)" : ""}
              >
                {m.text}
              </div>
            ))}
            {!msgs.length ? <div className="text-sm text-gray-400">No messages yet.</div> : null}
          </div>

          {!isOnline ? (
            <div className="mt-3 text-[11px] text-amber-700 font-bold">Offline: messages will queue locally.</div>
          ) : null}

          <div className="mt-4 flex items-center gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={restricted}
              placeholder={restricted ? "Thread unavailable" : "Message…"}
              className={cn(
                "flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200",
                restricted ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <button
              type="button"
              disabled={restricted}
              className={cn(
                "px-3 py-2 rounded-xl text-white",
                restricted ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:opacity-90"
              )}
              onClick={() => void send()}
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </div>

          <MentionPicker open={mentionOpen} query={mentionQuery} items={mentionCandidates} onPick={insertMention} />

          <div data-testid="thread-context-strip" className="mt-2 text-[11px] text-gray-400">
            Context: messages are sent under the thread’s locked Side unless you explicitly move it.
          </div>
        </div>
      </div>
    </div>
  );
}


// sd_609_inbox_thread_abort