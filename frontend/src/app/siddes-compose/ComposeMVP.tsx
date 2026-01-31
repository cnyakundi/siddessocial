"use client";

// sd_763_compose_mvp: Brutal MVP composer (identity + audience + text + media).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  Globe,
  ImagePlus,
  Loader2,
  Lock,
  Play,
  X,
} from "lucide-react";

import { CirclesMark } from "@/src/components/icons/CirclesMark";
import { useSide } from "@/src/components/SideProvider";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { usePrismAvatar } from "@/src/hooks/usePrismAvatar";

import { enqueuePost, removeQueuedItem } from "@/src/lib/offlineQueue";
import { toast } from "@/src/lib/toast";
import { FLAGS } from "@/src/lib/flags";
import { SIDES, SIDE_THEMES, isSideId, type SideId } from "@/src/lib/sides";
import type { PublicChannelId } from "@/src/lib/publicChannels";
import { PUBLIC_CHANNELS, labelForPublicChannel } from "@/src/lib/publicChannels";
import type { CircleDef, CircleId } from "@/src/lib/circles";
import { getCirclesProvider } from "@/src/lib/circlesProvider";
import { emitAudienceChanged, getStoredLastPublicTopic, getStoredLastSetForSide, pushStoredRecentSetForSide, setStoredLastPublicTopic, setStoredLastSetForSide } from "@/src/lib/audienceStore";

import { formatDurationMs, useComposeMedia } from "./useComposeMedia";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function AvatarMe({ side }: { side: SideId }) {
  const t = SIDE_THEMES[side];
  const { img, initials } = usePrismAvatar(side);

  return (
    <div
      className={cn(
        "w-12 h-12 rounded-full overflow-hidden border-2 flex items-center justify-center font-extrabold shrink-0 select-none",
        t.border,
        img ? "bg-gray-100" : cn(t.lightBg, t.text)
      )}
      aria-hidden="true"
      title="You"
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="w-full h-full object-contain bg-black" />
      ) : (
        initials
      )}
    </div>
  );
}

type ComposeError = {
  kind: "validation" | "restricted" | "network" | "server" | "unknown";
  message: string;
};

type ComposeDraft = {
  text: string;
  setId: CircleId | null;
  publicChannel: PublicChannelId;
  updatedAt: number;
};

type DraftStore = Partial<Record<SideId, ComposeDraft>>;
const DRAFTS_KEY = "sd.compose.drafts.v1";

function loadDraftStore(): DraftStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as DraftStore;
  } catch {
    return {};
  }
}

function saveDraft(side: SideId, draft: ComposeDraft) {
  if (typeof window === "undefined") return;
  try {
    const store = loadDraftStore();
    store[side] = draft;
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function clearDraft(side: SideId) {
  if (typeof window === "undefined") return;
  try {
    const store = loadDraftStore();
    if (store[side]) {
      delete store[side];
      window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(store));
    }
  } catch {
    // ignore
  }
}

function AudiencePickerSheet({
  open,
  onClose,
  side,
  setSide,
  circles,
  circlesLoaded,
  selectedCircleId,
  onPickCircle,
  publicChannel,
  onPickTopic,
  topicsEnabled,
  onNewCircle,
}: {
  open: boolean;
  onClose: () => void;
  side: SideId;
  setSide: (next: SideId) => void;
  circles: CircleDef[];
  circlesLoaded: boolean;
  selectedCircleId: CircleId | null;
  onPickCircle: (next: CircleId | null) => void;
  publicChannel: PublicChannelId;
  onPickTopic: (next: PublicChannelId) => void;
  topicsEnabled: boolean;
  onNewCircle: () => void;
}) {
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const SIDE_ORDER: SideId[] = ["public", "friends", "close", "work"];
  const filtered = Array.isArray(circles) ? circles.filter((c) => c && c.side === side) : [];

  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close audience picker"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onPointerDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200 max-h-[70dvh] md:max-h-[80vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Audience</h3>
            <div className="text-xs text-gray-500 mt-1">Pick a Side, then optionally a Circle.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-5">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">Side</div>
          <div className="flex gap-2 p-1 rounded-2xl bg-gray-50/80 border border-gray-100">
            {SIDE_ORDER.map((id) => {
              const t = SIDE_THEMES[id];
              const active = side === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSide(id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-extrabold transition-all border",
                    active ? "bg-white border-gray-200 shadow-sm" : "bg-transparent border-transparent text-gray-400 hover:text-gray-700 hover:bg-white/60"
                  )}
                  aria-label={SIDES[id].label}
                  title={SIDES[id].privacyHint}
                >
                  <span className={cn("w-2 h-2 rounded-full", t.primaryBg)} aria-hidden="true" />
                  <span className={cn(active ? t.text : "")}>{SIDES[id].label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {side === "public" ? (
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">Topic</div>

            {!topicsEnabled ? (
              <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-600">
                Topics are disabled in this build.
              </div>
            ) : (
              <div className="space-y-2">
                {PUBLIC_CHANNELS.map((c) => {
                  const active = publicChannel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onPickTopic(c.id);
                        onClose();
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                        active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                      )}
                      title={c.desc}
                    >
                      <div className="min-w-0">
                        <div className={cn("font-bold truncate", active ? "text-white" : "text-gray-900")}>{c.label}</div>
                        <div className={cn("text-[11px] truncate", active ? "text-white/80" : "text-gray-500")}>{c.desc}</div>
                      </div>
                      {active ? <span className="w-2.5 h-2.5 rounded-full bg-white" /> : <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-end justify-between gap-3 mb-2">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Circle</div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewCircle();
                }}
                className="text-[11px] font-extrabold text-gray-700 hover:text-gray-900 hover:underline"
              >
                New circle
              </button>
            </div>

            {!circlesLoaded ? (
              <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-600">Loading circles…</div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    onPickCircle(null);
                    onClose();
                  }}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                    !selectedCircleId ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                  )}
                  title={SIDES[side].privacyHint}
                >
                  <div className="min-w-0">
                    <div className={cn("font-bold truncate", !selectedCircleId ? "text-white" : "text-gray-900")}>All {SIDES[side].label}</div>
                    <div className={cn("text-[11px] truncate", !selectedCircleId ? "text-white/80" : "text-gray-500")}>{SIDES[side].privacyHint}</div>
                  </div>
                  {!selectedCircleId ? <span className="w-2.5 h-2.5 rounded-full bg-white" /> : <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                </button>

                {filtered.map((c) => {
                  const active = selectedCircleId === c.id;
                  const members = (c as any) && Array.isArray((c as any).members) ? (c as any).members.length : 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onPickCircle(c.id);
                        onClose();
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                        active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                      )}
                      title={c.label}
                    >
                      <div className="min-w-0">
                        <div className={cn("font-bold truncate", active ? "text-white" : "text-gray-900")}>{c.label}</div>
                        <div className={cn("text-[11px] truncate", active ? "text-white/80" : "text-gray-500")}>
                          {members ? `${members} people` : "Circle"}
                        </div>
                      </div>
                      {active ? <span className="w-2.5 h-2.5 rounded-full bg-white" /> : <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                    </button>
                  );
                })}

                {filtered.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-gray-200 bg-white text-sm text-gray-500">
                    No circles yet. Create one to target a smaller group.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={onClose} className="w-full mt-4 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
          Done
        </button>
      </div>
    </div>
  );
}

export default function ComposeMVP() {
  useLockBodyScroll(true);

  const { side, setSide } = useSide();
  const router = useRouter();
  const searchParams = useSearchParams();

  const theme = SIDE_THEMES[side];
  const title = side === "work" ? "New Update" : "New Post";

  const requestedSide: SideId | null = useMemo(() => {
    const raw = String(searchParams?.get("side") || "").trim().toLowerCase();
    return isSideId(raw) ? (raw as SideId) : null;
  }, [searchParams]);

  const requestedCircleId: CircleId | null = useMemo(() => {
    const raw = String(searchParams?.get("set") || "").trim();
    return raw ? (raw as CircleId) : null;
  }, [searchParams]);

  const requestedTopic: PublicChannelId | null = useMemo(() => {
    const raw = String(searchParams?.get("topic") || "").trim();
    return raw ? (raw as PublicChannelId) : null;
  }, [searchParams]);

  const mismatch = Boolean(requestedSide && requestedSide !== side);

  const [text, setText] = useState("");
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<ComposeError | null>(null);

  const setsProvider = useMemo(() => getCirclesProvider(), []);
  const [sets, setSets] = useState<CircleDef[]>([]);
  const [setsLoaded, setSetsLoaded] = useState(false);
  const [selectedCircleId, setSelectedCircleId] = useState<CircleId | null>(null);
  const [publicChannel, setPublicChannel] = useState<PublicChannelId>("general");
  const [audiencePickerOpen, setAudiencePickerOpen] = useState(false);

  const { fileInputRef, mediaItems, mediaBusy, mediaKeys, mediaMeta, pickMedia, addMediaFiles, removeMedia, clearMedia } = useComposeMedia();

  // Best-effort focus (some mobile browsers ignore autoFocus).
  useEffect(() => {
    const focus = () => {
      const el = textRef.current;
      if (!el) return;
      try {
        // @ts-ignore
        el.focus({ preventScroll: true });
      } catch {
        try {
          el.focus();
        } catch {
          // ignore
        }
      }
    };
    focus();
    const t = setTimeout(focus, 80);
    return () => clearTimeout(t);
  }, []);

  // Restore prompt/draft once.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;

    const prompt = String(searchParams?.get("prompt") || "").trim();
    if (prompt) {
      setText(prompt);
      restoredRef.current = true;
      return;
    }

    try {
      const store = loadDraftStore();
      const d = store[side];
      if (d && d.text && !text.trim()) {
        setText(d.text);
        setSelectedCircleId(d.setId ?? null);
        setPublicChannel((d.publicChannel as any) || "general");
      }
    } catch {
      // ignore
    }

    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, side]);

  const saveCurrentDraft = () => {
    const t = (text || "").trim();
    if (!t) return;
    saveDraft(side, {
      text: t,
      setId: selectedCircleId,
      publicChannel,
      updatedAt: Date.now(),
    });
  };

  const close = (opts?: { skipSaveDraft?: boolean; forceFeed?: boolean }) => {
    if (!opts?.skipSaveDraft && (text || "").trim()) saveCurrentDraft();

    if (opts?.forceFeed) {
      router.push(`/siddes-feed?r=${Date.now()}`);
      return;
    }

    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
        return;
      }
    } catch {
      // ignore
    }
    router.push("/siddes-feed");
  };

  // Escape closes compose.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, text, selectedCircleId, publicChannel]);

  // Reset audience on side change (after initial mount).
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setSelectedCircleId(null);
    setPublicChannel("general");
    setError(null);
  }, [side]);

  // Load sets after mount and when side changes.
  useEffect(() => {
    let mounted = true;
    setSetsLoaded(false);
    setSets([]);
    clearMedia(); // attachments never carry across Sides

    setsProvider
      .list({ side })
      .then((items) => {
        if (!mounted) return;
        setSets(items);
        setSetsLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;
        setSetsLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [setsProvider, side, clearMedia]);

  // Auto-apply audience from link/store.
  const autoAudienceAppliedSideRef = useRef<SideId | null>(null);
  useEffect(() => {
    if (autoAudienceAppliedSideRef.current === side) return;

    if (side === "public") {
      if (FLAGS.publicChannels) {
        const desired = String(requestedTopic || getStoredLastPublicTopic() || "").trim();
        if (desired && PUBLIC_CHANNELS.some((c) => c.id === desired)) {
          setPublicChannel(desired as any);
        }
      }
      autoAudienceAppliedSideRef.current = side;
      return;
    }

    if (!setsLoaded) return;
    if (selectedCircleId) {
      autoAudienceAppliedSideRef.current = side;
      return;
    }

    const desiredSet = String(requestedCircleId || getStoredLastSetForSide(side) || "").trim();
    if (desiredSet) {
      const found = sets.find((s) => s.id === desiredSet && s.side === side);
      if (found) setSelectedCircleId(found.id);
    }

    autoAudienceAppliedSideRef.current = side;
  }, [side, setsLoaded, sets, selectedCircleId, requestedCircleId, requestedTopic]);

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const selectedSet = useMemo(() => sets.find((s) => s.id === selectedCircleId) ?? null, [sets, selectedCircleId]);

  const audienceLabel =
    side === "public"
      ? (FLAGS.publicChannels ? labelForPublicChannel(publicChannel) : "All")
      : selectedSet
        ? selectedSet.label
        : "All";
  const maxChars = side === "public" ? 800 : 5000;
  const charCount = text.length;
  const overLimit = charCount > maxChars;
  const remaining = maxChars - charCount;
  const showCount = overLimit || remaining <= 100;
  const canPost = !mismatch && text.trim().length > 0 && !posting && !overLimit && !mediaBusy;

  const openAudience = () => {
    if (mismatch) return;
    setAudiencePickerOpen(true);
  };

  async function postNow(raw: string) {
    const t = (raw || "").trim();
    if (!t) return;
    if (posting) return;
    if (mismatch) return;

    if (t.length > maxChars) {
      setError({ kind: "validation", message: `Too long. Max ${maxChars} characters.` });
      saveCurrentDraft();
      return;
    }

    setPosting(true);
    setError(null);

    const reset = () => {
      setText("");
      setSelectedCircleId(null);
      setError(null);
      clearDraft(side);
      clearMedia();
    };

    const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;

    // Offline: queue and show undo.
    if (!onlineNow) {
      const queued = enqueuePost(side, t, {
        setId: selectedCircleId,
        urgent: false,
        publicChannel: side === "public" && FLAGS.publicChannels ? publicChannel : null,
      });
      reset();
      setPosting(false);
      toast.undo(`Queued: ${SIDES[side].label}`, () => removeQueuedItem(queued.id));
      close({ skipSaveDraft: true, forceFeed: true });
      return;
    }

    const clientKey = `ui_${Date.now()}`;
    try {
      // sd_153: real post call (MVP)
      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          side,
          text: t,
          setId: selectedCircleId,
          urgent: false,
          publicChannel: side === "public" && FLAGS.publicChannels ? publicChannel : null,
          client_key: clientKey,
          mediaKeys,
          mediaMeta: Object.keys(mediaMeta || {}).length ? mediaMeta : undefined,
        }),
      });

      if (res.ok) {
        const msg =
          `Posted: ${SIDES[side].label}` +
          (selectedSet ? ` • Circle: ${selectedSet.label}` : "") +
          (side === "public" && FLAGS.publicChannels ? ` • Topic: ${labelForPublicChannel(publicChannel)}` : "");
        reset();
        setPosting(false);
        toast.success(msg);
        close({ skipSaveDraft: true, forceFeed: true });
        return;
      }

      const j = await res.json().catch(() => null);
      const code = j && typeof (j as any).error === "string" ? String((j as any).error) : "request_failed";

      // Never destroy text on failure.
      saveCurrentDraft();

      if (res.status === 400) {
        if (code === "too_long" && j && typeof (j as any).max === "number") {
          setError({ kind: "validation", message: `Too long. Max ${(j as any).max} characters.` });
        } else if (code === "empty_text") {
          setError({ kind: "validation", message: "Write something first." });
        } else {
          setError({ kind: "validation", message: "Couldn’t post — please check your text and try again." });
        }
        setPosting(false);
        return;
      }

      if (res.status === 401) {
        setError({ kind: "restricted", message: "Login required to post." });
        setPosting(false);
        try {
          const next = encodeURIComponent("/siddes-compose");
          router.push(`/login?next=${next}`);
        } catch {
          // ignore
        }
        return;
      }

      if (res.status === 403) {
        if (code === "public_trust_low" && j && typeof (j as any).min_trust === "number") {
          setError({ kind: "restricted", message: `Public posting requires Trust L${(j as any).min_trust}+.` });
        } else if (code === "rate_limited" && j && typeof (j as any).retry_after_ms === "number") {
          const sec = Math.max(1, Math.round(Number((j as any).retry_after_ms) / 1000));
          setError({ kind: "restricted", message: `Slow down — try again in ${sec}s.` });
        } else {
          setError({ kind: "restricted", message: "Restricted: you can’t post here." });
        }
        setPosting(false);
        return;
      }

      if (res.status >= 500) {
        setError({ kind: "server", message: "Server error — draft saved. Try again." });
        setPosting(false);
        return;
      }

      setError({ kind: "unknown", message: "Couldn’t post — draft saved. Try again." });
      setPosting(false);
    } catch {
      saveCurrentDraft();
      setError({ kind: "network", message: "Network error — draft saved. Try again." });
      setPosting(false);
    }
  }

  async function submit() {
    const t = text.trim();
    if (!t) return;
    if (overLimit) {
      setError({ kind: "validation", message: `Too long. Max ${maxChars} characters.` });
      saveCurrentDraft();
      return;
    }
    await postNow(t);
  }

  const reqBanner = mismatch ? (
    <div className={cn("px-6 py-2 border-b flex items-center justify-between", SIDE_THEMES[requestedSide!].lightBg, SIDE_THEMES[requestedSide!].border)}>
      <div className={cn("text-[11px] font-bold", SIDE_THEMES[requestedSide!].text)}>
        This compose link targets <span className="font-extrabold">{SIDES[requestedSide!].label}</span>. Enter it to post safely.
      </div>
      <button
        type="button"
        onClick={() => setSide(requestedSide!)}
        className={cn("px-3 py-1.5 rounded-full text-xs font-extrabold text-white hover:opacity-90", SIDE_THEMES[requestedSide!].primaryBg)}
      >
        Enter {SIDES[requestedSide!].label}
      </button>
    </div>
  ) : null;

  return (
    <>
      <div className="fixed inset-0 z-[99] flex items-end justify-center md:items-center">
        <button
          type="button"
          aria-label="Close compose"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => close()}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "relative w-full md:max-w-2xl bg-white overflow-hidden flex flex-col shadow-2xl",
            "rounded-t-3xl md:rounded-3xl",
            "ring-1 ring-white/20",
            error ? "ring-2 ring-red-500" : null,
            "animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200"
          )}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        >
          {/* Header */}
          <div className="px-6 md:px-8 py-4 border-b border-gray-100 bg-white flex items-center justify-between">
            <button type="button" onClick={() => close()} className="text-sm font-bold text-gray-700 hover:text-gray-900">
              Cancel
            </button>

            <div className="text-sm font-extrabold text-gray-900">{title}</div>

            <button
              type="button"
              onClick={submit}
              disabled={!canPost}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-extrabold text-white inline-flex items-center gap-2 transition-all",
                canPost ? cn(theme.primaryBg, "hover:opacity-90 active:scale-95") : "bg-gray-300 cursor-not-allowed"
              )}
              aria-label="Post"
              title={!canPost ? (mismatch ? "Switch to the link’s Side" : overLimit ? `Too long (max ${maxChars})` : posting ? "Posting…" : mediaBusy ? "Wait for uploads" : "Write something first") : "Post"}
            >
              {posting ? <Loader2 size={16} className="animate-spin" /> : null}
              {posting ? "Posting…" : "Post"}
            </button>
          </div>

          {/* Audience row */}
          <div className="px-6 md:px-8 pt-3 pb-3">
            <button
              type="button"
              onClick={openAudience}
              disabled={mismatch}
              className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Choose audience"
              title="Choose audience"
            >
              <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />
              <span className={cn("text-sm font-extrabold", theme.text)}>{SIDES[side].label}</span>
              <span className="text-gray-300">•</span>
              <span className="text-sm font-bold text-gray-900 truncate max-w-[260px]">{audienceLabel}</span>
              <ChevronDown size={16} className="text-gray-400 shrink-0 ml-auto" />
            </button>

            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400 font-semibold">
              {side === "public" ? <Globe size={12} className="text-gray-300" /> : <Lock size={12} className="text-gray-300" />}
              <span>{SIDES[side].privacyHint}</span>
            </div>
          </div>

          {reqBanner}

          {/* Public hint (always visible in MVP) */}
          {side === "public" ? (
            <div className={cn("px-6 py-2 border-b flex items-center justify-between", theme.lightBg, theme.border)}>
              <div className={cn("flex items-center gap-2 text-[11px] font-medium", theme.text)}>
                <Globe size={12} />
                <span>{SIDES.public.privacyHint}. Post carefully.</span>
              </div>
            </div>
          ) : null}

          {/* Editor */}
          <div className="p-6 md:p-8 min-h-[320px] flex flex-col">
            <div className="sr-only">{title}</div>
            <div className="flex gap-5">
              <AvatarMe side={side} />

              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-gray-400 mb-2">
                  You are posting as <span className={cn("font-extrabold", theme.text)}>{SIDES[side].label}</span>
                </div>

                <textarea
                  ref={textRef}
                  value={text}
                  disabled={mismatch}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (error?.kind === "validation") setError(null);
                  }}
                  placeholder={
                    mismatch
                      ? `Switch to ${SIDES[requestedSide!].label} to start writing…`
                      : side === "public"
                        ? "Share to Public…"
                        : side === "friends"
                          ? "Say something to Friends…"
                          : side === "close"
                            ? "Share with Inner Circle…"
                            : "Note for Work…"
                  }
                  className={cn(
                    "w-full h-40 resize-none outline-none text-xl text-gray-900 placeholder:text-gray-300 bg-transparent leading-relaxed",
                    mismatch ? "opacity-60" : null
                  )}
                  autoFocus
                />

                {error ? (
                  <div className="mt-3 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-2xl inline-flex items-center gap-2 max-w-full">
                    <AlertTriangle size={12} />
                    <span className="truncate">{error.message}</span>
                  </div>
                ) : null}

                {mediaItems.length > 0 ? (
                  <div className="mt-3">
                    <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                      {mediaItems.slice(0, 4).map((m) => {
                        const failed = m.status === "failed";
                        const uploading = m.status === "uploading";
                        return (
                          <div
                            key={m.id}
                            className={cn(
                              "relative snap-start shrink-0 w-[78%] max-w-[360px] rounded-3xl overflow-hidden border-2 bg-gray-50",
                              failed ? "border-red-200" : "border-gray-100"
                            )}
                            title={m.name}
                          >
                            {m.previewUrl ? (
                              m.kind === "video" ? (
                                <div className="relative w-full h-56 lg:h-64 bg-black">
                                  <video src={m.previewUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-14 h-14 rounded-full bg-black/35 backdrop-blur flex items-center justify-center">
                                      <Play size={26} className="text-white" />
                                      {typeof m.durationMs === "number" && m.durationMs > 0 ? (
                                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/45 text-white text-xs font-semibold">
                                          {formatDurationMs(m.durationMs)}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.previewUrl} alt="" className="w-full h-56 lg:h-64 object-contain bg-black" />
                              )
                            ) : (
                              <div className="w-full h-56 lg:h-64 flex items-center justify-center text-xs font-bold text-gray-400">Media</div>
                            )}

                            <button
                              type="button"
                              onClick={() => removeMedia(m.id)}
                              className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60"
                              aria-label="Remove media"
                              title="Remove"
                            >
                              <X size={18} />
                            </button>

                            {(uploading || failed) && (
                              <div className={cn("absolute inset-0 flex items-center justify-center text-sm font-extrabold", failed ? "bg-red-500/40 text-white" : "bg-black/35 text-white")}>
                                {uploading ? "Uploading…" : "Failed"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 md:px-8 py-4 bg-white border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={pickMedia}
                disabled={mismatch || posting || mediaBusy || !isOnline || mediaItems.length >= 4}
                className={cn(
                  "w-10 h-10 rounded-full border flex items-center justify-center transition-colors",
                  mismatch || posting || mediaBusy || !isOnline || mediaItems.length >= 4
                    ? "border-gray-200 text-gray-300 bg-white cursor-not-allowed"
                    : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                )}
                aria-label="Add media"
                title={!isOnline ? "Go online to upload media" : mediaItems.length >= 4 ? "Max 4 media" : "Add media"}
              >
                <ImagePlus size={18} />
              </button>
            </div>

            {showCount ? (
              <span className={cn("text-[10px] font-mono", overLimit ? "text-red-600 font-bold" : "text-gray-400")}>
                {charCount} / {maxChars}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          const files = e.currentTarget.files;
          if (files && files.length) {
            void addMediaFiles(files);
          }
          e.currentTarget.value = "";
        }}
      />

      {/* Audience sheet */}
      <AudiencePickerSheet
        open={audiencePickerOpen}
        onClose={() => setAudiencePickerOpen(false)}
        side={side}
        setSide={setSide}
        circles={sets}
        circlesLoaded={setsLoaded}
        selectedCircleId={selectedCircleId}
        onPickCircle={(next) => {
          setSelectedCircleId(next);
          try { setStoredLastSetForSide(side, next); } catch {}
          try { if (next) pushStoredRecentSetForSide(side, next); } catch {}
          try { emitAudienceChanged({ side, setId: next, topic: null, source: "ComposeMVP" }); } catch {}
        }}
        publicChannel={publicChannel}
        onPickTopic={(next) => {
          setPublicChannel(next);
          try { setStoredLastPublicTopic(next || null); } catch {}
          try { emitAudienceChanged({ side: "public", setId: null, topic: next || null, source: "ComposeMVP" }); } catch {}
        }}
        topicsEnabled={FLAGS.publicChannels}
        onNewCircle={() => router.push("/siddes-circles?create=1")}
      />
</>
  );
}
